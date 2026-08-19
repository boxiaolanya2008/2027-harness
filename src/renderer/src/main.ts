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
import arrowLeft from '@iconify-icons/mdi/arrow-left'
import github from '@iconify-icons/mdi/github'
import magnify from '@iconify-icons/mdi/magnify'
import folderPlusOutline from '@iconify-icons/mdi/folder-plus-outline'
import folderOpenOutline from '@iconify-icons/mdi/folder-open-outline'
import messageTextOutline from '@iconify-icons/mdi/message-text-outline'
import deleteOutline from '@iconify-icons/mdi/delete-outline'
import pencilOutline from '@iconify-icons/mdi/pencil-outline'
import undo from '@iconify-icons/mdi/undo'
import history from '@iconify-icons/mdi/history'
import paletteOutline from '@iconify-icons/mdi/palette-outline'
import tuneVariant from '@iconify-icons/mdi/tune-variant'
import creationOutline from '@iconify-icons/mdi/creation-outline'
import arrowUp from '@iconify-icons/mdi/arrow-up'
import chevronRight from '@iconify-icons/mdi/chevron-right'
import alertCircleOutline from '@iconify-icons/mdi/alert-circle-outline'
import headSnowflakeOutline from '@iconify-icons/mdi/head-snowflake-outline'
import tools from '@iconify-icons/mdi/tools'
import pageLayoutSidebarRight from '@iconify-icons/mdi/page-layout-sidebar-right'
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
addIcon('mdi:arrow-left', arrowLeft)
addIcon('mdi:github', github)
addIcon('mdi:magnify', magnify)
addIcon('mdi:folder-plus-outline', folderPlusOutline)
addIcon('mdi:folder-open-outline', folderOpenOutline)
addIcon('mdi:message-text-outline', messageTextOutline)
addIcon('mdi:delete-outline', deleteOutline)
addIcon('mdi:pencil-outline', pencilOutline)
addIcon('mdi:undo', undo)
addIcon('mdi:history', history)
addIcon('mdi:palette-outline', paletteOutline)
addIcon('mdi:tune-variant', tuneVariant)
addIcon('mdi:creation-outline', creationOutline)
addIcon('mdi:arrow-up', arrowUp)
addIcon('mdi:chevron-right', chevronRight)
addIcon('mdi:alert-circle-outline', alertCircleOutline)
addIcon('mdi:head-snowflake-outline', headSnowflakeOutline)
addIcon('mdi:tools', tools)
addIcon('mdi:page-layout-sidebar-right', pageLayoutSidebarRight)

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })
app.mount('#app')
