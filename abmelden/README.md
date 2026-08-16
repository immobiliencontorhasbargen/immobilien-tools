# Abmeldung von Immobilienvorschlägen

Die Seite verwendet zwei Vercel-Serverfunktionen:

- `POST /api/abmeldung-anfordern`
- `POST /api/abmeldung-bestaetigen?token=...`

## Einmalige Einrichtung

1. `supabase/unsubscribe_requests.sql` im vorgesehenen Supabase-Projekt ausführen.
2. In Vercel folgende Umgebungsvariablen für Production, Preview und Development hinterlegen:

```text
PUBLIC_BASE_URL=https://tools.immobilien-kaiserbaeder.de
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=immobilien contor hasbargen <no-reply@deiner-domain.de>
RESEND_INTERNAL_NOTIFICATION_EMAIL=
ONOFFICE_API_TOKEN=
ONOFFICE_API_SECRET=
ONOFFICE_USER_ID=21
```

`ONOFFICE_USER_ID` ist optional. Die API-Zugangsdaten dürfen nie in HTML oder clientseitigem JavaScript auftauchen.

## Verhalten

Nach Bestätigung des Links wird ausschließlich der über die E-Mail-Adresse eindeutig gefundene onOffice-Kontakt verarbeitet:

- `autoExposeVersand` wird auf `false` gesetzt.
- Eine eingehende E-Mail-Aktivität wird dokumentiert.
- Optional wird eine interne Benachrichtigung über Resend verschickt.

Der Link ist 15 Minuten gültig und wird nur einmal verarbeitet. Die Suche antwortet bei unbekannten Adressen bewusst neutral, damit keine Kontaktdaten ausgelesen werden können.

Vor dem produktiven Versand müssen die Resend-Absenderdomain und die Vercel-Umgebungsvariablen eingerichtet sowie ein End-to-End-Test mit einem ausdrücklich freigegebenen Testkontakt durchgeführt werden.