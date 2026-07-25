import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// singlefile используется для шаринг-превью одним файлом;
// перед реальным деплоем вернём обычную чанк-сборку.
export default defineConfig({
  plugins: [svelte(), tailwindcss(), viteSingleFile()],
})
