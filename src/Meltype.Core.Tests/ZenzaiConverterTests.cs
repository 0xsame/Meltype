// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Yukishiro

using System.Net;
using System.Text;
using System.Text.Json;
using Meltype.Composition;
using Meltype.Config;

namespace Meltype.Tests;

/// <summary>Zenzai (llama-server の /completion) の変換。本物のサーバーの代わりに、同じ形で答える小さな HTTP サーバーを動かす。</summary>
internal static class ZenzaiConverterTests
{
    /// <summary>受け取った prompt を記録して、answer(prompt) を content にして返す。status が 200 以外ならそのエラーを返す。</summary>
    private sealed class FakeServer : IDisposable
    {
        private readonly HttpListener _listener = new();
        public List<string> Prompts { get; } = [];
        public int Status { get; set; } = 200;
        public Func<string, string> Answer { get; set; } = _ => "";

        /// <summary>答えの 1 文字ごとの確率 (本物のサーバーは completion_probabilities で返す)。</summary>
        public double Probability { get; set; } = 0.9;
        public Uri Endpoint { get; }

        public FakeServer()
        {
            var port = 0;
            for (var tries = 0; tries < 20; tries++)
            {
                port = Random.Shared.Next(20000, 60000);
                try { _listener.Prefixes.Add($"http://127.0.0.1:{port}/"); _listener.Start(); break; }
                catch (HttpListenerException) { _listener.Prefixes.Clear(); }
            }
            Endpoint = new Uri($"http://127.0.0.1:{port}/");
            Task.Run(Loop);
        }

        private void Loop()
        {
            while (_listener.IsListening)
            {
                try
                {
                    var context = _listener.GetContext();
                    var body = new StreamReader(context.Request.InputStream, Encoding.UTF8).ReadToEnd();
                    var prompt = "";
                    if (body.Length > 0) prompt = JsonDocument.Parse(body).RootElement.GetProperty("prompt").GetString() ?? "";
                    lock (Prompts) Prompts.Add(prompt);
                    context.Response.StatusCode = Status;
                    var answer = Answer(prompt);
                    var probabilities = answer.Select(ch => new { content = ch.ToString(), probs = new[] { new { tok_str = ch.ToString(), prob = Probability } } }).ToArray();
                    var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { content = answer, completion_probabilities = probabilities }));
                    context.Response.OutputStream.Write(bytes);
                    context.Response.Close();
                }
                catch (Exception ex) when (ex is HttpListenerException or ObjectDisposedException or InvalidOperationException) { return; }
            }
        }

        public void Dispose() => _listener.Close();
    }

    [Test]
    public static void Prompt_UsesKatakanaAndContext()
    {
        Assert.Equal("キョウ", ZenzaiConverter.Prompt("きょう", null), "文脈なし");
        Assert.Equal("アツイこの本は", ZenzaiConverter.Prompt("あつい", "この本は"), "文脈あり");
        Assert.Equal("ー、。ABC", ZenzaiConverter.ToKatakana("ー、。ABC"), "かな以外はそのまま");
    }

    [Test]
    public static void Clean_RemovesEndMarks()
    {
        Assert.Equal("今日", ZenzaiConverter.Clean("今日</s>")!, "EOS");
        Assert.Equal("今日", ZenzaiConverter.Clean(" 今日ゴミ")!, "区切り記号以降");
        Assert.True(ZenzaiConverter.Clean("</s>") is null, "空は null");
    }

    [Test]
    public static void Converts_ThroughCompletionEndpoint()
    {
        using var server = new FakeServer { Answer = p => p.Contains("キョウ") ? "今日</s>" : "" };
        using var zenzai = new ZenzaiConverter(server.Endpoint);
        var clauses = zenzai.ConvertClauses("きょう", "朝");
        Assert.True(clauses is [{ Reading: "きょう", Text: "今日" }], "1 つの文節で返る");
        Assert.True(server.Prompts.Count == 1 && server.Prompts[0] == "キョウ朝", "渡した文: " + string.Join("|", server.Prompts));
        zenzai.ConvertClauses("きょう", "朝");
        Assert.Equal(1, server.Prompts.Count, "同じ読みと文脈は覚えている");
    }

    [Test]
    public static void LowConfidenceAnswers_AreLeftToOtherEngines()
    {
        // 文脈の無い きょう → 強 のように、モデルが迷っている (確率が低い) 答えは使わない。確かなら短くても使う
        using var unsure = new FakeServer { Answer = p => "強", Probability = 0.13 };
        using var zenzai = new ZenzaiConverter(unsure.Endpoint);
        Assert.True(zenzai.ConvertClauses("きょう") is null, "自信が低ければ null");
        Assert.Equal(1, unsure.Prompts.Count, "聞いた");
        Assert.True(zenzai.ConvertClauses("きょう") is null && unsure.Prompts.Count == 1, "使わないと決めた答えも覚えていて、聞き直さない");
        Assert.True(zenzai.IsAvailable, "自信が低いだけでは諦めない");
        using var sure = new FakeServer { Answer = p => "今日", Probability = 0.97 };
        using var confident = new ZenzaiConverter(sure.Endpoint);
        Assert.True(confident.ConvertClauses("きょう", "明日は") is [{ Text: "今日" }], "確かなら短くても使う");
        // 2 文字の答えの確率は積 (0.7 × 0.7 = 0.49 なら使う、0.6 × 0.6 = 0.36 なら使わない)
        using var two = new FakeServer { Answer = p => "公園", Probability = 0.7 };
        Assert.True(new ZenzaiConverter(two.Endpoint).ConvertClauses("こうえん") is [{ Text: "公園" }], "積が下限以上");
        two.Probability = 0.6;
        Assert.True(new ZenzaiConverter(two.Endpoint).ConvertClauses("こうえん") is null, "積が下限未満");
    }

    [Test]
    public static void UnchangedAnswer_IsNotUsed_AndDoesNotCountAsFailure()
    {
        using var server = new FakeServer { Answer = p => "かんたんなもんだい" };
        using var zenzai = new ZenzaiConverter(server.Endpoint);
        for (var i = 0; i < 4; i++) Assert.True(zenzai.ConvertClauses("かんたんなもんだい", "前の文") is null, "読みのままなら null");
        Assert.True(zenzai.IsAvailable, "変換しなかっただけでは諦めない");
    }

    [Test]
    public static void ServerErrors_FallBackAndGiveUp()
    {
        using var server = new FakeServer { Status = 500 };
        using var zenzai = new ZenzaiConverter(server.Endpoint);
        for (var i = 0; i < 3; i++) Assert.True(zenzai.ConvertClauses("あ" + new string('い', i), "前の文") is null, "失敗したら null");
        Assert.True(!zenzai.IsAvailable, "3 回失敗したら諦める");
        Assert.True(!new ZenzaiConverter("/no/such/llama-server", "/no/such.gguf").IsAvailable, "実行ファイルが無ければ使えない");
    }

    [Test]
    public static void SlowServer_PausesZenzaiForAWhile()
    {
        using var server = new FakeServer { Answer = p => { Thread.Sleep(300); return "遅い"; } };
        using var zenzai = new ZenzaiConverter(server.Endpoint, timeoutMs: 100);
        Assert.True(zenzai.ConvertClauses("あ", "前の文") is null, "間に合わなければ null");
        var before = server.Prompts.Count;
        Assert.True(zenzai.ConvertClauses("い", "前の文") is null, "しばらくは頼まない");
        Thread.Sleep(50);
        Assert.Equal(before, server.Prompts.Count, "遅いあいだはサーバーに頼まない");
        Assert.True(zenzai.IsAvailable, "遅いだけでは諦めない (また使える)");
    }

    [Test]
    public static void Hybrid_PrefersZenzaiAndKeepsOtherClausesWhenSame()
    {
        using var server = new FakeServer { Answer = p => p.Contains("タンイヲトル") ? "単位を取る" : "ひらがな" };
        using var zenzai = new ZenzaiConverter(server.Endpoint);
        var hybrid = new HybridConverter(() => ConversionEngine.System, null, new CompositionTests.FakeConverter(), null, () => zenzai);
        // FakeConverter は たんいをとる を 単位を|取る の 2 文節にする。同じ文字列なら、その区切りを使う
        var same = hybrid.ConvertClauses("たんいをとる");
        Assert.True(same is [{ Text: "単位を" }, { Text: "取る" }], "同じなら区切りを使う: " + string.Join("|", same?.Select(c => c.Text) ?? []));
        // 違えば Zenzai の結果
        var other = hybrid.ConvertClauses("たんい", "前の文");
        Assert.True(other is [{ Reading: "たんい", Text: "ひらがな" }], "違えば Zenzai: " + string.Join("|", other?.Select(c => c.Text) ?? []));
        // 使わない設定 (null) なら今までどおり
        var off = new HybridConverter(() => ConversionEngine.System, null, new CompositionTests.FakeConverter(), null, () => null);
        Assert.Equal("単位", off.Convert("たんい") ?? "", "OFF は今までどおり");
    }

    /// <summary>
    /// 本物の llama-server と zenz のモデルがあるときだけ動かす (環境変数 MELTYPE_ZENZAI_SERVER と MELTYPE_ZENZAI_MODEL)。
    /// zenz の前処理 (gpt2-small-japanese-char) は、azooKey の llama.cpp の fork (ensan-hcl/llama.cpp) でしか読めない。
    /// </summary>
    [Test]
    public static void RealZenz_ConvertsWhenAvailable()
    {
        if (Environment.GetEnvironmentVariable("MELTYPE_ZENZAI_SERVER") is not { Length: > 0 } server ||
            Environment.GetEnvironmentVariable("MELTYPE_ZENZAI_MODEL") is not { Length: > 0 } model) return;
        using var zenzai = new ZenzaiConverter(server, model, timeoutMs: 5000);
        zenzai.WarmUp();
        // 起動を待つ (モデルを読み込むので数秒かかる)
        var clauses = (IReadOnlyList<ConversionClause>?)null;
        for (var i = 0; i < 100 && clauses is null; i++)
        {
            clauses = zenzai.ConvertClauses("きょうはいいてんきですね");
            if (clauses is null) Thread.Sleep(300);
        }
        Assert.Equal("今日はいい天気ですね", clauses is [var c] ? c.Text : "(変換できなかった)", "文を変換");
        var chopsticks = zenzai.ConvertClauses("はし", "ごはんをたべるための");
        var bridge = zenzai.ConvertClauses("はし", "みずうみにかかる");
        Assert.Equal("箸", chopsticks is [var a] ? a.Text : "", "文脈 (食べる) で 箸");
        Assert.Equal("橋", bridge is [var b] ? b.Text : "", "文脈 (湖にかかる) で 橋");
        // 文脈の無い きょう は、モデルが迷う (強 / 今 / 鏡 / 京がほぼ同じ確率) ので使わず、Mozc などに任せる。文脈があれば今日
        Assert.True(zenzai.ConvertClauses("きょう") is null, "文脈なしの きょう は使わない");
        Assert.Equal("今日", zenzai.ConvertClauses("きょう", "あしたは") is [var today] ? today.Text : "", "文脈 (あしたは) で 今日");
    }
}
