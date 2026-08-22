# Koci Posiłek — MVP

**KOTY** — prosta aplikacja Expo (Android/iOS) do wspólnego rejestrowania karmienia i opieki nad Angelą i Bastą.

Nagłówek wykorzystuje rodzinne zdjęcie kotów z subtelnym przyciemnieniem dla czytelności, a wieczorny posiłek ma bezmarkową ikonę saszetki przygotowaną jako osobny asset UI.

## Architektura

- **UI:** React Native + Expo + TypeScript, jeden kod dla Androida i iOS.
- **Stan:** mały stan komponentu; bez dodatkowego frameworka.
- **Dane:** repozytorium przełącza się automatycznie między AsyncStorage (demo/offline) a Supabase.
- **Synchronizacja:** Supabase Realtime odświeża listę po każdym zapisie na dowolnym telefonie.
- **Tożsamość:** domownik wybiera nazwę na urządzeniu; wybór trafia tylko do pamięci telefonu.

## Ekrany MVP

1. **Wybór domownika** — przy pierwszym uruchomieniu.
2. **Dzisiaj** — sześć pól karmienia, szybkie karmienie obu kotów oraz zabawa, szczotkowanie i kuweta.
3. **Historia** — karmienia i czynności z poprzednich dni, ułożone chronologicznie.

## Model danych

Każde karmienie i każda czynność opieki są osobnymi, nieusuwanymi zdarzeniami. Zabawa i szczotkowanie odnoszą się do wybranego kota, a kuweta jest jednym wspólnym wpisem. Dzień aplikacji zmienia się automatycznie o 02:00 czasu lokalnego — wtedy wszystkie statusy stają się ponownie dostępne, bez usuwania historii. Celowe ponowne wykonanie czynności tworzy kolejny rekord po potwierdzeniu.

## Uruchomienie

```bash
npm install
npm start
```

Bez konfiguracji aplikacja działa lokalnie na jednym urządzeniu. Aby włączyć współdzielenie:

1. Utwórz projekt Supabase.
2. Uruchom `supabase/schema.sql` w SQL Editor.
3. Skopiuj `.env.example` do `.env` i wpisz URL oraz klucz anon.
4. Uruchom ponownie Expo.

Dla chmurowych buildów APK te same zmienne należy dodać do środowiska `preview` w Expo EAS. Po ich osadzeniu wszystkie telefony z tym samym APK korzystają z jednej bazy i odbierają zmiany przez Supabase Realtime.

> Polityki MVP pozwalają każdemu posiadaczowi klucza anon czytać i dodawać wpisy. Przed publicznym udostępnieniem należy dodać kod gospodarstwa domowego lub logowanie anonimowe i zawęzić RLS.

## Instalacyjny APK

Profil `preview` w `eas.json` tworzy plik APK możliwy do bezpośredniej instalacji na telefonie:

```bash
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

Po zakończeniu EAS wyświetli adres pobierania APK. Android może poprosić o jednorazową zgodę na instalację aplikacji z przeglądarki.
