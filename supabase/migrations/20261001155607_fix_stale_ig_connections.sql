-- Mark any Instagram connections saved before the crypto fix as 'error'
-- so they can be reconnected cleanly with the correct encryption key
update public.instagram_connections
set status = 'error', access_token_encrypted = ''
where status = 'connected';
