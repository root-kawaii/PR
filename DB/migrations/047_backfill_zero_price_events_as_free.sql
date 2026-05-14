UPDATE events
SET entry_type = 'free'
WHERE entry_type = 'ticketed'
  AND REGEXP_REPLACE(TRIM(COALESCE(price, '')), '[^0-9,.-]', '', 'g') ~ '^-?0*([.,]0+)?$';
