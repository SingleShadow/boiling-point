const config = {
  projectName: 'boiling-mobile',
  date: '2026-09-15',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    375: 2,
    828: 1.81 / 2
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: [],
  defineConstants: {},
  copy: {
    patterns: [],
    options: {}
  },
  framework: 'react',
  compiler: 'webpack5',
  cache: {
    enable: false
  },
  h5: {
    publicPath: '/app/',
    staticDirectory: 'static',
    output: {
      filename: 'js/[name].[hash:8].js',
      chunkFilename: 'js/[name].[chunkHash:8].js'
    },
    router: {
      mode: 'hash'
    },
    devServer: {
      port: 10086,
      host: '0.0.0.0'
    },
    postcss: {
      autoprefixer: {
        enable: true
      },
      cssModules: {
        enable: false
      }
    }
  },
  mini: {
    postcss: {
      autoprefixer: { enable: true },
      cssModules: {
        enable: false
      }
    }
  },
  rn: {
    appName: 'boilingmobile'
  }
}

module.exports = config
