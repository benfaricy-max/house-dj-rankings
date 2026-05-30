import sys, json

# args: term1 term2 ... (first term is the ANCHOR). Up to 5 terms (Google limit).
terms = sys.argv[1:]
try:
    from pytrends.request import TrendReq
    pt = TrendReq(hl="en-US", tz=0, timeout=(10, 25))
    pt.build_payload(terms, timeframe="today 12-m")
    df = pt.interest_over_time()
    if df.empty:
        print(json.dumps({"error": "empty"}))
        sys.exit(0)
    out = {"_weeks": [d.strftime("%Y-%m-%d") for d in df.index]}
    for t in terms:
        if t in df.columns:
            out[t] = [int(v) for v in df[t].tolist()]
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({"error": str(e)[:120]}))
