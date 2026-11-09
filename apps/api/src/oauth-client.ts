import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type {
  OAuthClientInformationMixed,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';

// Her sign-in to another tool's server (spec 025, US4), as the MCP SDK's OAuth client needs it:
// Jarvis registers itself with the server, sends her to its sign-in page, then keeps the tokens.
// All of it lives in one object, sealed by the server in the connector's row.

export interface SignIn {
  client?: OAuthClientInformationMixed;
  tokens?: OAuthTokens;
  verifier?: string;
  /** The request on its way: the connector and a nonce, checked when she comes back. */
  state?: string;
}

export function signInProvider(input: {
  redirectUrl: string;
  signIn: SignIn;
  save: (signIn: SignIn) => Promise<void>;
  /** Where to send her: the server's sign-in page (only while she signs in). */
  onRedirect?: (url: URL) => void;
}): OAuthClientProvider {
  const kept: SignIn = { ...input.signIn };
  const save = async (change: Partial<SignIn>) => {
    Object.assign(kept, change);
    await input.save({ ...kept });
  };
  return {
    get redirectUrl() {
      return input.redirectUrl;
    },
    get clientMetadata() {
      return {
        client_name: 'Jarvis OS',
        redirect_uris: [input.redirectUrl],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      };
    },
    state: () => kept.state ?? '',
    clientInformation: () => kept.client,
    saveClientInformation: (client) => save({ client }),
    tokens: () => kept.tokens,
    saveTokens: (tokens) => save({ tokens }),
    redirectToAuthorization: (url) => input.onRedirect?.(url),
    saveCodeVerifier: (verifier) => save({ verifier }),
    codeVerifier: () => {
      if (!kept.verifier) throw new Error('No sign-in on its way: start it again.');
      return kept.verifier;
    },
  };
}
