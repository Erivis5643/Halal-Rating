-- Seed awards catalog
insert into public.awards (name, emoji) values
  ('90KG Bench press', '🏋️'),
  ('100KG Bench press', '🏋️‍♂️'),
  ('110KG Bench press', '🏋️‍♀️'),
  ('120+KG Bench press', '💪'),
  ('Marathon', '🏅'),
  ('SAS-Komponent', '🎖️'),
  ('Backflip', '🤸'),
  ('64 Backflips', '🔁'),
  ('Krasse Durchnahme', '🔥')
on conflict (name) do nothing;


