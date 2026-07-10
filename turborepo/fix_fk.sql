UPDATE leady SET adres_id = NULL WHERE adres_id IS NOT NULL AND adres_id NOT IN (SELECT id FROM adresy);
UPDATE leady SET klient_id = NULL WHERE klient_id IS NOT NULL AND klient_id NOT IN (SELECT id FROM klienci);
