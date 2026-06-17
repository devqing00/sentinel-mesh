import pandas as pd
from datetime import datetime, timezone

# create cache df
df_cache = pd.DataFrame({
    'timestamp': pd.to_datetime(['2024-03-01 12:00:00']).dt.tz_localize('UTC')
})

# create live buffer
live_buffer = [{
    'timestamp': datetime.now(timezone.utc)
}]

live_df = pd.DataFrame(live_buffer)

print("Concatenating...")
res = pd.concat([df_cache, live_df])
print("Done. Types:", res.dtypes)
