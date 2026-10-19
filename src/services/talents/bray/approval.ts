import {Alert} from 'react-native';

/**
 * Ask Bo before a tool changes anything. Shows an Alert with Deny / Allow;
 * resolves true only on Allow (dismissing counts as Deny).
 */
export function askApproval(title: string, detail: string): Promise<boolean> {
  return new Promise(resolve => {
    let settled = false;
    const done = (v: boolean) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    Alert.alert(
      title,
      detail,
      [
        {text: 'Deny', style: 'cancel', onPress: () => done(false)},
        {text: 'Allow', onPress: () => done(true)},
      ],
      {cancelable: true, onDismiss: () => done(false)},
    );
  });
}
