import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import DisplayView from './lib/components/DisplayView.svelte'

// #display — окно проектора: только приём и показ, без данных и пульта
const isDisplay = window.location.hash === '#display'

const app = mount(isDisplay ? DisplayView : App, {
  target: document.getElementById('app')!,
})

export default app
