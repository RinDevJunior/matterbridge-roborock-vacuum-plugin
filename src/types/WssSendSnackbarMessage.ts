import { MatterbridgeDynamicPlatform } from 'matterbridge';

export type WssSendSnackbarMessage = (message: string, timeout?: number, severity?: 'error' | 'success' | 'info' | 'warning') => void;

interface PlatformWithSnackbar {
  wssSendSnackbarMessage?: WssSendSnackbarMessage;
}

interface FrontendWithSnackbar {
  frontend?: { wssSendSnackbarMessage: WssSendSnackbarMessage };
}

export function getWssSendSnackbarMessage(platform: MatterbridgeDynamicPlatform): WssSendSnackbarMessage {
  const { frontend } = platform.matterbridge as FrontendWithSnackbar;
  return (
    (platform as PlatformWithSnackbar).wssSendSnackbarMessage?.bind(platform) ??
    frontend?.wssSendSnackbarMessage.bind(frontend) ??
    ((message, _timeout, _severity) => platform.log.notice(message))
  );
}
