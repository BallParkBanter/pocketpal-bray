import {Alert} from 'react-native';

/**
 * Allow/Deny dialog for MCP tools that change things. Same contract as Part B's
 * `bray/approval.ts` (`askApproval(title, detail)`); kept separate so the
 * parallel worktrees don't collide. Fold into one when they merge.
 */
export function askMcpApproval(
  title: string,
  detail: string,
): Promise<boolean> {
  return new Promise(resolve => {
    Alert.alert(
      title,
      detail,
      [
        {text: 'Deny', style: 'cancel', onPress: () => resolve(false)},
        {text: 'Allow', onPress: () => resolve(true)},
      ],
      {cancelable: true, onDismiss: () => resolve(false)},
    );
  });
}
