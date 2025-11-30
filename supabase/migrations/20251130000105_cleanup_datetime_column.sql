-- Cleanup fake datetime values
-- Previously, we stored dates as midnight UTC in the datetime column.
-- Now that we have a dedicated date column, we should set datetime to NULL
-- for these "fake" timestamps to avoid confusion.

-- We identify "fake" timestamps as those that are exactly midnight UTC.
-- While it's possible a real transaction happened exactly at midnight UTC,
-- it is highly unlikely compared to the volume of backfilled dates.

UPDATE public.transactions
SET datetime = NULL
WHERE 
  -- Check if the time part of the timestamp (in UTC) is 00:00:00
  EXTRACT(HOUR FROM datetime AT TIME ZONE 'UTC') = 0 
  AND EXTRACT(MINUTE FROM datetime AT TIME ZONE 'UTC') = 0 
  AND EXTRACT(SECOND FROM datetime AT TIME ZONE 'UTC') = 0;
