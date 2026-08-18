import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { addIcon } from '@iconify/vue'
import cog from '@iconify-icons/mdi/cog'
import folderOpen from '@iconify-icons/mdi/folder-open'
import plus from '@iconify-icons/mdi/plus'
import robotOutline from '@iconify-icons/mdi/robot-outline'
import sourcePull from '@iconify-icons/mdi/source-pull'
import sourceCommit from '@iconify-icons/mdi/source-commit'
import checkCircle from '@iconify-icons/mdi/check-circle'
import alertCircle from '@iconify-icons/mdi/alert-circle'
import dotsHorizontal from '@iconify-icons/mdi/dots-horizontal'
import loading from '@iconify-icons/mdi/loading'
import App from './App.vue'
import router from './router'
import './styles/main.css'

// 离线注册图标，避免运行时从 Iconify CDN 拉取
addIcon('mdi:cog', cog)
addIcon('mdi:folder-open', folderOpen)
addIcon('mdi:plus', plus)
addIcon('mdi:robot-outline', robotOutline)
addIcon('mdi:source-pull', sourcePull)
addIcon('mdi:source-commit', sourceCommit)
addIcon('mdi:check-circle', checkCircle)
addIcon('mdi:alert-circle', alertCircle)
addIcon('mdi:dots-horizontal', dotsHorizontal)
addIcon('mdi:loading', loading)

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })
app.mount('#app')
