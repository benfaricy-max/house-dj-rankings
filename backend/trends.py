import sys
import json

artist_name = sys.argv[1]

try:
    from pytrends.request import TrendReq

    pytrends = TrendReq(hl="en-US", tz=360)
    pytrends.build_payload([artist_name], timeframe="now 7-d")

    # Overall trend score
    data = pytrends.interest_over_time()
    avg = 0
    direction = "flat"
    if not data.empty:
        values = data[artist_name].tolist()
        avg = sum(values) / len(values)
        direction = "up" if values[-1] > values[0] else "down" if values[-1] < values[0] else "flat"

    # Interest by region (country level)
    region_data = pytrends.interest_by_region(resolution="COUNTRY", inc_low_vol=False)
    top_countries = (
        region_data[artist_name]
        .sort_values(ascending=False)
        .head(5)
        .to_dict()
    ) if artist_name in region_data.columns else {}

    # Interest by US city
    pytrends.build_payload([artist_name], timeframe="now 7-d", geo="US")
    city_data = pytrends.interest_by_region(resolution="CITY", inc_low_vol=False)
    top_cities = (
        city_data[artist_name]
        .sort_values(ascending=False)
        .head(5)
        .to_dict()
    ) if artist_name in city_data.columns else {}

    print(json.dumps({
        "score": round(avg, 1),
        "direction": direction,
        "top_countries": top_countries,
        "top_us_cities": top_cities,
    }))

except Exception as e:
    print(json.dumps({
        "score": 0,
        "direction": "flat",
        "top_countries": {},
        "top_us_cities": {},
        "error": str(e)
    }))
