import { useLaunch } from '@tarojs/taro'
import './app.css'

function App({ children }) {
  useLaunch(() => {
    console.log('沸点创意 App launched.')
  })

  return children
}

export default App
