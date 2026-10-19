import React, {useEffect, useState} from 'react';
import {ScrollView, StyleSheet} from 'react-native';
import {observer} from 'mobx-react-lite';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  Button,
  Card,
  HelperText,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';

import {useTheme} from '../../../../hooks';
import {mcpBridge, McpServerStatus} from './McpBridge';
import {mcpServerStore} from './McpServerStore';

/** Drawer route name; registered in App.tsx, opened from Settings. */
export const MCP_SERVERS_ROUTE = 'MCP Servers';

const statusText = (s?: McpServerStatus): string => {
  switch (s?.state) {
    case 'ok':
      return `connected · ${s.toolCount} tools`;
    case 'unreachable':
      return `not reachable · ${s.toolCount} tools (cached)`;
    case 'error':
      return `error: ${s.message}`;
    case 'connecting':
      return 'connecting…';
    default:
      return 'off';
  }
};

/** "Name: value" → header map (one header; enough for a bearer token). */
const parseHeader = (raw: string): Record<string, string> | undefined => {
  const idx = raw.indexOf(':');
  if (idx <= 0) {
    return undefined;
  }
  const key = raw.slice(0, idx).trim();
  const value = raw.slice(idx + 1).trim();
  return key && value ? {[key]: value} : undefined;
};

/** Settings → MCP Servers: list, add, remove, enable/disable. */
export const McpServersScreen: React.FC = observer(() => {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [tools, setTools] = useState('');
  const [header, setHeader] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mcpServerStore.load().catch(() => undefined);
  }, []);

  const add = async () => {
    const problem = await mcpServerStore.addServer({
      name,
      url,
      tools: tools.split(/[,\s]+/).filter(Boolean),
      headers: parseHeader(header),
    });
    setError(problem);
    if (!problem) {
      setName('');
      setUrl('');
      setTools('');
      setHeader('');
    }
  };

  return (
    <SafeAreaView
      style={[styles.root, {backgroundColor: theme.colors.background}]}
      edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        testID="mcp-servers-screen">
        <Text variant="bodyMedium" style={styles.intro}>
          Each tool on an MCP server becomes a talent named
          mcp_&lt;server&gt;_&lt;tool&gt;. Turn it on for a Pal in the Pal's
          Talents section.
        </Text>

        {mcpServerStore.servers.length === 0 ? (
          <Text variant="bodyMedium" testID="mcp-no-servers">
            No MCP servers yet.
          </Text>
        ) : null}

        {mcpServerStore.servers.map(server => (
          <Card
            key={server.name}
            elevation={0}
            style={styles.card}
            testID={`mcp-server-${server.name}`}>
            <Card.Title
              title={server.name}
              subtitle={server.url}
              right={() => (
                <Switch
                  testID={`mcp-server-switch-${server.name}`}
                  value={server.enabled}
                  onValueChange={v => {
                    mcpServerStore
                      .setEnabled(server.name, v)
                      .catch(() => undefined);
                  }}
                />
              )}
            />
            <Card.Content>
              <Text
                variant="bodySmall"
                testID={`mcp-server-status-${server.name}`}>
                {server.enabled
                  ? statusText(mcpBridge.status.get(server.name))
                  : 'off'}
              </Text>
              <Text variant="bodySmall">
                Tools: {server.tools?.length ? server.tools.join(', ') : 'all'}
              </Text>
            </Card.Content>
            <Card.Actions>
              <Button
                testID={`mcp-server-remove-${server.name}`}
                onPress={() => {
                  mcpServerStore
                    .removeServer(server.name)
                    .catch(() => undefined);
                }}>
                Remove
              </Button>
            </Card.Actions>
          </Card>
        ))}

        <Button
          mode="outlined"
          style={styles.button}
          loading={mcpBridge.syncing}
          testID="mcp-reconnect"
          onPress={() => {
            mcpBridge.sync().catch(() => undefined);
          }}>
          Reconnect all
        </Button>

        <Card elevation={0} style={styles.card} testID="mcp-add-card">
          <Card.Title title="Add a server" />
          <Card.Content>
            <TextInput
              testID="mcp-name-input"
              label="Name (e.g. joplin)"
              value={name}
              onChangeText={setName}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <TextInput
              testID="mcp-url-input"
              label="URL (Streamable HTTP)"
              placeholder="http://192.168.1.50:9095/mcp"
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={styles.input}
            />
            <TextInput
              testID="mcp-tools-input"
              label="Only these tools (optional, comma-separated)"
              value={tools}
              onChangeText={setTools}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <TextInput
              testID="mcp-header-input"
              label="Header (optional, Name: value)"
              value={header}
              onChangeText={setHeader}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            {error ? (
              <HelperText type="error" testID="mcp-add-error">
                {error}
              </HelperText>
            ) : null}
            <Button mode="contained" testID="mcp-add-button" onPress={add}>
              Add server
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
});

/** Small card for the top of Settings that opens McpServersScreen. */
export const McpServersSettingsCard: React.FC = observer(() => {
  const navigation = useNavigation<any>();
  const count = mcpServerStore.servers.length;
  return (
    <Card elevation={0} style={styles.card} testID="mcp-settings-card">
      <Card.Title
        title="MCP Servers"
        subtitle={`${count} server${count === 1 ? '' : 's'}`}
      />
      <Card.Actions>
        <Button
          testID="mcp-open-servers"
          onPress={() => navigation.navigate(MCP_SERVERS_ROUTE)}>
          Manage MCP servers
        </Button>
      </Card.Actions>
    </Card>
  );
});

const styles = StyleSheet.create({
  root: {flex: 1},
  content: {padding: 16, gap: 12},
  intro: {marginBottom: 4},
  card: {borderRadius: 12},
  input: {marginBottom: 8},
  button: {alignSelf: 'flex-start'},
});
