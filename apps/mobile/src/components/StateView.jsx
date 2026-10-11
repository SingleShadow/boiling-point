import { View, Text } from '@tarojs/components'
import { COLORS } from '../theme'

// 统一状态视图：loading / error / empty
// status: 'loading' | 'error' | 'empty' | 'success'
export default function StateView({
  status,
  onRetry,
  emptyText = '暂无数据',
  errorText = '加载失败',
}) {
  if (status === 'success' || !status) return null

  return (
    <View
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 16px',
      }}
    >
      {status === 'loading' && (
        <View style={{ alignItems: 'center' }}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: `3px solid ${COLORS.border}`,
              borderTopColor: COLORS.orange,
              // 简单转动动画（H5 生效）
              animation: 'bp-spin 0.8s linear infinite',
            }}
          />
          <Text style={{ marginTop: 12, fontSize: 13, color: COLORS.sub }}>
            加载中…
          </Text>
        </View>
      )}

      {status === 'empty' && (
        <Text style={{ fontSize: 14, color: COLORS.sub }}>{emptyText}</Text>
      )}

      {status === 'error' && (
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 14, color: COLORS.sub }}>{errorText}</Text>
          {onRetry ? (
            <View
              onClick={onRetry}
              style={{
                marginTop: 16,
                padding: '8px 20px',
                borderRadius: 20,
                background: COLORS.orange,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 14 }}>点击重试</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  )
}
