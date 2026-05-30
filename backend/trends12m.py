import sys, json

artist = sys.argv[1]
try:
    from pytrends.request import TrendReq
    pt = TrendReq(hl="en-US", tz=0, timeout=(10, 25))
    pt.build_payload([artist], timeframe="today 12-m")
    df = pt.interest_over_time()
    if df.empty or artist not in df.columns:
        print(json.dumps({"series": [], "current": 0, "direction": "flat"}))
        sys.exit(0)

    vals = [int(v) for v in df[artist].tolist()]
    weeks = [d.strftime("%Y-%m-%d") for d in df.index]
    series = [{"w": w, "v": v} for w, v in zip(weeks, vals)]
    n = len(vals)

    def avg(a):
        return sum(a) / len(a) if a else 0
    def pct(a, b):
        return round((a - b) / b * 100, 1) if b and b > 0 else 0

    recent4  = avg(vals[-4:])
    prior4   = avg(vals[-8:-4]) if n >= 8 else avg(vals[:max(1, n - 4)])
    recent12 = avg(vals[-12:]) if n >= 12 else None
    prior12  = avg(vals[-24:-12]) if n >= 24 else None

    out = {
        "series": series,
        "current": round(recent4, 1),
        "direction": "up" if vals[-1] > vals[0] else "down" if vals[-1] < vals[0] else "flat",
        "mom_4w_pct":  pct(recent4, prior4),
        "mom_12w_pct": pct(recent12, prior12) if (recent12 is not None and prior12 is not None) else 0,
        "peak": max(vals) if vals else 0,
    }
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({"error": str(e)[:120]}))
