import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '../../.env' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testInsert() {
  const { data: klient, error: klientError } = await supabase
    .from('klienci')
    .insert({
      imie_i_nazwisko: "Test",
      email: "test@test.com",
      telefon: "123123123"
    })
    .select('id')
    .single();

  if (klientError) return console.error('Klient error:', klientError);

  const { data: adres, error: adresError } = await supabase
    .from('adresy')
    .insert({
      klient_id: klient.id,
      ulica_miasto: "Test Address"
    })
    .select('id')
    .single();

  if (adresError) return console.error('Adres error:', adresError);

  const { error: leadError } = await supabase
    .from('leady')
    .insert({
      klient_id: klient.id,
      adres_id: adres.id,
      odpowiedzi_triage: {},
      status: 'NEW_LEAD',
      data_rezerwacji: new Date().toISOString()
    });

  if (leadError) return console.error('Lead error:', leadError);
  console.log('Success!');
}

testInsert();
