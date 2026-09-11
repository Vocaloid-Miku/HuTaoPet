import './assets/main.css'
import 'ant-design-vue/dist/reset.css'

import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import ColorPicker from '@indusy/antdv-color-picker'
import ModalApp from './ModalApp.vue'

createApp(ModalApp).use(Antd).use(ColorPicker).mount('#app')
