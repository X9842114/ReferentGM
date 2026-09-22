-- Stockage public des bannières de profil. Les écritures passent uniquement
-- par les routes serveur utilisant la service role key.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'refgm-profile-media',
  'refgm-profile-media',
  true,
  1500000,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
