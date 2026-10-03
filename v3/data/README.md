# Исходные данные v3

Каталог `source/` содержит исходные JavaScript-базы четырёх переводов
Библии и песен на трёх языках (`songs_ru.js`, `songs_kk.js`, `songs_ky.js`). Они хранятся в Git и являются входом для команды:

```bash
npm run data
```

Конвертер очищает и проверяет данные, затем создаёт JSON-файлы в
`v3/public/data/`. Сгенерированные JSON и demo-набор не хранятся в Git.

Формат исходников с глобальными `window.*` сохранён только для безопасной
миграции существующих данных. Runtime v2 для их чтения не используется.

`raw/` содержит исходный SQLite-модуль KYB для проверки происхождения
данных; production-сборка его не загружает.

## Песни: откуда и как обновить

Все три базы песен — выгрузки Worship Leader App для OpenLP, по одной
SQLite-базе на язык. Сайт пересобирает их ежедневно:

```
https://worshipleaderapp.com/download/openlp3/ru.sqlite
https://worshipleaderapp.com/download/openlp3/kk.sqlite
https://worshipleaderapp.com/download/openlp3/ky.sqlite
```

Скачанную базу превращает в исходник скрипт импорта (нужен Node 22.13+):

```bash
node scripts/import-songs.mjs kk ~/Downloads/kk.sqlite
node scripts/import-songs.mjs ky ~/Downloads/ky.sqlite
npm run data
```

Импорт выбрасывает пустышки (нет текста, только аккорды, «минусовки»),
сортирует песни по названию по правилам языка и раскладывает секции по
меткам «[Куплет 1]», «[Припев 1]». Казахская и киргизская базы импортированы
так 3 октября 2026 года. Русская `songs_ru.js` получена из `ru.sqlite` ещё
летом 2026 года, до появления скрипта; её можно переимпортировать тем же
скриптом (`ru`).
