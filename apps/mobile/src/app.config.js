export default {
  pages: [
    'pages/index/index',
    'pages/detail/detail',
    'pages/report/report',
    'pages/tags/tags',
    'pages/mine/mine'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#16181D',
    navigationBarTitleText: '沸点创意',
    navigationBarTextStyle: 'white',
    backgroundColor: '#F7F8FA'
  },
  tabBar: {
    color: '#8A919F',
    selectedColor: '#FF5A1F',
    backgroundColor: '#FFFFFF',
    borderStyle: 'black',
    list: [
      { pagePath: 'pages/index/index', text: '今日' },
      { pagePath: 'pages/report/report', text: '报告' },
      { pagePath: 'pages/mine/mine', text: '我的' }
    ]
  }
}
