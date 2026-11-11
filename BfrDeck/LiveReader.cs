using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Text.RegularExpressions;
using Windows.Graphics.Imaging;
using Windows.Media.Ocr;

namespace BfrDeck;

/// <summary>
/// Optional live stats: pulls the emulator's screen through adb (a plain screencap, no input, nothing injected),
/// crops the home-screen header and reads the numbers with the OCR engine that ships with Windows.
/// Off by default. Only ever reads pixels.
/// </summary>
public sealed class LiveReader
{
    public sealed class Result
    {
        public bool ok { get; set; }
        public int? level { get; set; }
        public long? gems { get; set; }
        public long? zel { get; set; }
        public long? karma { get; set; }
        public string? name { get; set; }
        public string? error { get; set; }
        public string? at { get; set; }
    }

    /// <summary>The latest frame as PNG (for the unit scanner); captured at most twice a second.</summary>
    private byte[]? _lastFrame; private DateTime _lastFrameAt;
    public async Task<byte[]?> FrameAsync()
    {
        if (_adb == null) return null;
        if (_lastFrame != null && (DateTime.UtcNow - _lastFrameAt).TotalMilliseconds < 500) return _lastFrame;
        var png = await CaptureAsync();
        if (png != null) { _lastFrame = png; _lastFrameAt = DateTime.UtcNow; if (DebugDir != null) try { File.WriteAllBytes(Path.Combine(DebugDir, "frame-last.png"), png); } catch { } }
        return png;
    }

    private readonly Action<string> _log;
    private readonly string? _adb;
    private OcrEngine? _ocr;
    public bool Enabled { get; set; }
    public Result Last { get; private set; } = new() { ok = false, error = "off" };
    public string Device { get; set; } = "127.0.0.1:5555";
    public string? DebugDir { get; set; }   // when set, the processed crops are saved here

    public LiveReader(Action<string> log)
    {
        _log = log;
        _adb = FindAdb();
        try { _ocr = OcrEngine.TryCreateFromUserProfileLanguages() ?? OcrEngine.TryCreateFromLanguage(new Windows.Globalization.Language("en-US")); }
        catch (Exception ex) { _log("ocr init failed: " + ex.Message); }
        if (_ocr == null) _log("no OCR engine available (install a language pack with OCR in Windows settings)");
    }

    private static string? FindAdb()
    {
        // Prefer the current platform-tools adb; BlueStacks' bundled HD-Adb is an older server version and the
        // two kill each other's server when both are used.
        var candidates = new List<string>();
        var winget = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Microsoft\WinGet\Packages");
        if (Directory.Exists(winget))
            candidates.AddRange(Directory.EnumerateFiles(winget, "adb.exe", SearchOption.AllDirectories));
        foreach (var dir in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(';'))
            if (dir.Length > 0) candidates.Add(Path.Combine(dir, "adb.exe"));
        candidates.Add(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Android\Sdk\platform-tools\adb.exe"));
        candidates.Add(@"C:\Program Files\BlueStacks_nxt\HD-Adb.exe");
        return candidates.FirstOrDefault(File.Exists);
    }

    /// <summary>One capture + read. Safe to call every few seconds; never throws.</summary>
    public async Task<Result> ReadAsync()
    {
        try
        {
            if (_adb == null) return Last = new Result { error = "adb not found (install Android platform-tools)" };
            if (_ocr == null) return Last = new Result { error = "Windows OCR not available" };
            var png = await FrameAsync();
            if (png == null) return Last = new Result { error = "no screen from the emulator (is adb enabled in BlueStacks settings?)" };
            var r = await ReadFrameAsync(png);
            if (r.name == null && Last.name != null) r.name = Last.name;   // keep the last good name while on other screens
            return Last = r;
        }
        catch (Exception ex) { _log("live read failed: " + ex); return Last = new Result { error = ex.Message }; }
    }

    // The two header panels on the 1080x1920 screen. Windows OCR is unreliable on a tiny crop holding two or three
    // digits ("95", "617" came back empty) but reads a whole panel fine, so each panel is read once and its lines are
    // assigned by position: left panel = name (top line) and "Lv <n>"; right panel = gems, Zel, Karma top to bottom.
    private static readonly Rectangle LeftPanel = new(0, 0, 340, 120);
    private static readonly Rectangle RightPanel = new(770, 50, 310, 175);

    /// <summary>OCR of a small PNG (a unit-list badge such as "×4"): returns the raw text, or "" when nothing reads.</summary>
    public async Task<string> OcrTextAsync(byte[] png)
    {
        try
        {
            using var bmp = new Bitmap(new MemoryStream(png));
            var res = await OcrRawAsync(bmp, new Rectangle(0, 0, bmp.Width, bmp.Height), 4, 24);
            return res?.Text ?? "";
        }
        catch (Exception ex) { _log("ocr text failed: " + ex.Message); return ""; }
    }

    /// <summary>Reads a PNG frame (also used by `BfrDeck.exe --ocrtest file.png`).</summary>
    public async Task<Result> ReadFrameAsync(byte[] png)
    {
        using var frame = new Bitmap(new MemoryStream(png));
        var scale = frame.Width / 1080.0;
        var r = new Result { at = DateTime.UtcNow.ToString("o") };
        Rectangle S(Rectangle b) => new((int)(b.X * scale), (int)(b.Y * scale), (int)(b.Width * scale), (int)(b.Height * scale));

        // Line y values are relative to the panel's top edge, in frame pixels.
        var left = await OcrLinesAsync(frame, S(LeftPanel));
        foreach (var (text, y) in left)
        {
            // "Lv 95" on one line, or "Lv" and "95 RC 0" split in two: the level is the number on the Lv row (y ≈ 60–105).
            var m = Regex.Match(text, @"L\s*[vV]\s*\.?\s*(\d{1,3})\b");
            if (!m.Success && y > 55 * scale && y < 110 * scale) m = Regex.Match(text, @"^\s*(\d{1,3})\b");
            if (m.Success) { var n = int.Parse(m.Groups[1].Value); if (n is >= 1 and <= 999) r.level = n; continue; }
            if (r.name == null && y < 55 * scale)
            {
                var nm = Regex.Replace(text, @"[^\p{L}\p{N} _\-\.'!?]", "").Trim();
                if (nm.Length is >= 2 and <= 16 && !Regex.IsMatch(nm, @"^(EXP|Energy|RC|Lv)$", RegexOptions.IgnoreCase)) r.name = nm;
            }
        }
        var right = await OcrLinesAsync(frame, S(RightPanel));
        var numbers = right.Select(l => (digits: Regex.Replace(l.text, @"[^0-9]", ""), l.y)).Where(x => x.digits.Length is >= 1 and <= 12).OrderBy(x => x.y).ToList();
        // Rows sit at fixed heights (frame y 86 / 140 / 192); pick each by nearest row centre so a missed row does not shift the others.
        long? Row(double frameY) { var c = (frameY - RightPanel.Y) * scale; var best = numbers.Where(x => Math.Abs(x.y - c) < 26 * scale).OrderBy(x => Math.Abs(x.y - c)).FirstOrDefault(); return best.digits == null ? null : long.Parse(best.digits); }
        r.gems = Row(86); r.zel = Row(140); r.karma = Row(192);
        _log($"live: name='{r.name}' level={r.level} gems={r.gems} zel={r.zel} karma={r.karma} (left: {string.Join(" | ", left.Select(l => l.text))}; right: {string.Join(" | ", right.Select(l => l.text))})");
        r.ok = r.level != null || r.gems != null || r.zel != null;
        if (!r.ok) r.error = "Not on the home screen (no header found)";
        return r;
    }

    // OCR a region and return its text lines with their vertical centre in frame pixels (relative to the region top).
    private async Task<List<(string text, double y)>> OcrLinesAsync(Bitmap frame, Rectangle rect)
    {
        const int up = 3, pad = 30;
        var res = await OcrRawAsync(frame, rect, up, pad);
        var lines = new List<(string, double)>();
        if (res == null) return lines;
        foreach (var line in res.Lines)
        {
            if (line.Words.Count == 0) continue;
            var cy = line.Words.Average(w => w.BoundingRect.Y + w.BoundingRect.Height / 2);
            lines.Add((line.Text, (cy - pad) / up));
        }
        return lines;
    }

    // Crop, upscale and threshold to black-on-white so the OCR sees clean bold text. Returns the raw OCR result.
    private async Task<OcrResult?> OcrRawAsync(Bitmap frame, Rectangle rect, int up, int pad)
    {
        if (rect.Right > frame.Width || rect.Bottom > frame.Height || _ocr == null) return null;
        using var crop = new Bitmap(rect.Width * up + pad * 2, rect.Height * up + pad * 2, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(crop))
        {
            g.Clear(Color.Black);
            g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
            g.DrawImage(frame, new Rectangle(pad, pad, rect.Width * up, rect.Height * up), rect, GraphicsUnit.Pixel);
        }
        var data = crop.LockBits(new Rectangle(0, 0, crop.Width, crop.Height), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        try
        {
            unsafe
            {
                var p = (byte*)data.Scan0;
                // Adaptive threshold: digits are the brightest thing in the box, whatever overlay dims the screen.
                int min = 255, max = 0;
                for (int y = 0; y < crop.Height; y++)
                for (int x = 0; x < crop.Width; x++)
                {
                    var i = y * data.Stride + x * 4;
                    var lum = (p[i] * 114 + p[i + 1] * 587 + p[i + 2] * 299) / 1000;
                    if (lum < min) min = lum; if (lum > max) max = lum;
                }
                var cut = min + (max - min) * 0.55;
                for (int y = 0; y < crop.Height; y++)
                for (int x = 0; x < crop.Width; x++)
                {
                    var i = y * data.Stride + x * 4;
                    var lum = (p[i] * 114 + p[i + 1] * 587 + p[i + 2] * 299) / 1000;
                    var v = (byte)(lum > cut ? 0 : 255);   // invert: black text on white reads best
                    p[i] = v; p[i + 1] = v; p[i + 2] = v; p[i + 3] = 255;
                }
            }
        }
        finally { crop.UnlockBits(data); }
        if (DebugDir != null) try { crop.Save(Path.Combine(DebugDir, $"ocr-{rect.X}-{rect.Y}.png"), ImageFormat.Png); } catch { }
        using var ms = new MemoryStream();
        crop.Save(ms, ImageFormat.Bmp);
        ms.Position = 0;
        using var ras = ms.AsRandomAccessStream();
        var decoder = await BitmapDecoder.CreateAsync(ras);
        using var sb = await decoder.GetSoftwareBitmapAsync(BitmapPixelFormat.Bgra8, BitmapAlphaMode.Premultiplied);
        return await _ocr!.RecognizeAsync(sb);
    }

    private async Task<byte[]?> CaptureAsync()
    {
        try
        {
            var psi = new ProcessStartInfo(_adb!, $"-s {Device} exec-out screencap -p") { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false, CreateNoWindow = true };
            using var p = Process.Start(psi)!;
            var ms = new MemoryStream();
            var copy = p.StandardOutput.BaseStream.CopyToAsync(ms);
            if (await Task.WhenAny(copy, Task.Delay(15000)) != copy) { try { p.Kill(); } catch { } return null; }
            await copy;
            await p.WaitForExitAsync();
            var bytes = ms.ToArray();
            if (bytes.Length < 8 || bytes[1] != 'P' || bytes[2] != 'N' || bytes[3] != 'G')
            {
                // adb may need a connect first
                await RunAdbAsync($"connect {Device}");
                return null;
            }
            return bytes;
        }
        catch (Exception ex) { _log("capture failed: " + ex.Message); return null; }
    }

    private async Task RunAdbAsync(string args)
    {
        try
        {
            var psi = new ProcessStartInfo(_adb!, args) { RedirectStandardOutput = true, UseShellExecute = false, CreateNoWindow = true };
            using var p = Process.Start(psi)!;
            await p.WaitForExitAsync();
        }
        catch { }
    }
}
