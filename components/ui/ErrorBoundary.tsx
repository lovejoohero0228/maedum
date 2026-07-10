// 렌더링 중 예외가 나면 흰 화면 대신 에러 메시지를 그대로 보여준다.
// (콘솔을 볼 수 없는 환경에서도 어떤 에러인지 바로 읽고 전달할 수 있게)
import { Component, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, ui } from '@/constants/colors';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={ui.statement}>문제가 발생했어요</Text>
        <Text style={styles.sub}>
          아래 내용을 캡처하거나 복사해서 알려주시면 원인을 바로 확인할 수 있어요.
        </Text>
        <Pressable style={styles.retry} onPress={() => this.setState({ error: null })}>
          <Text style={ui.pillText}>다시 시도</Text>
        </Pressable>
        <View style={styles.rule} />
        <Text style={styles.message}>{error.message}</Text>
        {error.stack ? <Text style={styles.stack}>{error.stack}</Text> : null}
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 28, paddingTop: 120 },
  sub: { ...ui.statementSub, marginTop: 12 },
  retry: { ...ui.pill, alignSelf: 'center', marginTop: 24 },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
    width: 48,
    alignSelf: 'center',
    marginVertical: 28,
  },
  message: { fontSize: 14, color: colors.ink, fontFamily: fonts.bodyMedium, marginBottom: 14 },
  stack: { fontSize: 11, color: colors.ink3, fontFamily: fonts.body, lineHeight: 16 },
});
