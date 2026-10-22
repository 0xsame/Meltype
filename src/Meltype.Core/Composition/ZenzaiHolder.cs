// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Serugu

namespace Meltype.Composition;

/// <summary>
/// Zenzai (llama-server + zenz の GGUF) の持ち主。設定で ON のときだけ作り、指定の場所が変わるたびに作り直す。
/// 作れない・変換で例外になった (<see cref="Failed"/>) ときは止めて、<see cref="RetryAfter"/> たってから作り直す
/// (打つたびに例外にしない。一時的な失敗で、ずっと止めたままにもしない。#973)。
/// 止める (Dispose) のはここだけで、使う側 (HybridConverter) は止めない。
/// </summary>
/// <param name="create">llama-server と GGUF の場所から作る (テストでは差し替える)。</param>
/// <param name="now">今の時刻 (ミリ秒。テストでは差し替える)。</param>
public sealed class ZenzaiHolder(Func<string, string, ZenzaiConverter>? create = null, Func<long>? now = null) : IDisposable
{
    private readonly Func<string, string, ZenzaiConverter> _create = create ?? CreateAndWarmUp;
    private readonly Func<long> _now = now ?? (() => Environment.TickCount64);
    private ZenzaiConverter? _zenzai;
    private string _key = "";
    private long _retryAt;

    /// <summary>作れなかった・止めたあと、もう一度作るまでの時間。</summary>
    public TimeSpan RetryAfter { get; init; } = TimeSpan.FromMinutes(5);

    /// <summary>今の Zenzai。場所が空 (OFF) なら止めて null。作れない・止めて待っている間も null (変換は Mozc などで続ける)。</summary>
    public ZenzaiConverter? Get(string serverPath, string modelPath)
    {
        var server = serverPath.Trim();
        var model = modelPath.Trim();
        if (server.Length == 0 || model.Length == 0)
        {
            // OFF にした・場所を空にしたら、llama-server を止める (メモリと CPU を使い続けないように)
            Stop();
            _key = "";
            return null;
        }
        var key = server + "|" + model;
        if (key != _key)
        {
            Stop();
            _key = key;
            _retryAt = 0;
        }
        if (_zenzai is null && _now() >= _retryAt)
        {
            try
            {
                _zenzai = _create(server, model);
            }
            catch (Exception ex)
            {
                // 作れないとき (#973: 同梱の .NET に System.Net.Http が無い) は、変換は Mozc などで続ける
                // (HybridConverter は Zenzai が無ければ今までどおり変換する)
                WaitBeforeRetry();
                Diagnostics.Log.Error($"Zenzai を使えないので、今までの変換エンジンで変換します ({RetryAfter.TotalMinutes} 分後にもう一度試します): {ex}");
            }
        }
        return _zenzai;
    }

    /// <summary>変換で例外になった Zenzai を止める (HybridConverter から)。<see cref="RetryAfter"/> たってから作り直す。</summary>
    public void Failed(ZenzaiConverter failed)
    {
        if (!ReferenceEquals(failed, _zenzai)) return;
        Stop();
        WaitBeforeRetry();
        Diagnostics.Log.Info($"Zenzai を止めました。{RetryAfter.TotalMinutes} 分後にもう一度使います");
    }

    public void Dispose() => Stop();

    private void Stop()
    {
        _zenzai?.Dispose();
        _zenzai = null;
    }

    private void WaitBeforeRetry() => _retryAt = _now() + (long)RetryAfter.TotalMilliseconds;

    private static ZenzaiConverter CreateAndWarmUp(string server, string model)
    {
        var zenzai = new ZenzaiConverter(server, model);
        try
        {
            if (zenzai.IsInstalled) zenzai.WarmUp();
            return zenzai;
        }
        catch
        {
            zenzai.Dispose();
            throw;
        }
    }
}
