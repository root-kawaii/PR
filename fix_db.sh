#!/bin/bash
export DATABASE_URL="postgresql://postgres.xxqexjtkgjfvhdyuoovq:WishYouWereHere75!@aws-1-eu-central-2.pooler.supabase.com:5432/postgres"
echo "ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255);" | docker run --rm -i postgres:latest psql "$DATABASE_URL"
