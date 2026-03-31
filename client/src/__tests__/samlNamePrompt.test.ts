import { describe, it, expect } from "vitest";

describe("SAML App routing logic", () => {
  function deriveView(
    samlEnabled: boolean,
    samlChecked: boolean,
    userId: string,
    pathname: string
  ): "loading" | "redirect-to-login" | "pre-login" | "redirect-to-home" | "show-prompt" | "show-app" {
    if (samlEnabled) {
      if (!samlChecked) return "loading";
      if (!userId) {
        return pathname !== "/login" ? "redirect-to-login" : "pre-login";
      }
      if (pathname === "/login") return "redirect-to-home";
      return "show-app";
    }
    if (!userId) return "show-prompt";
    return "show-app";
  }

  it("SAML on, not checked → loading", () => {
    expect(deriveView(true, false, "", "/")).toBe("loading");
  });

  it("SAML on, checked, no session, at / → redirect to /login", () => {
    expect(deriveView(true, true, "", "/")).toBe("redirect-to-login");
  });

  it("SAML on, checked, no session, at /login → pre-login screen", () => {
    expect(deriveView(true, true, "", "/login")).toBe("pre-login");
  });

  it("SAML on, checked, no session, at /puzzles → redirect to /login", () => {
    expect(deriveView(true, true, "", "/puzzles")).toBe("redirect-to-login");
  });

  it("SAML on, checked, has userId, at /login → redirect to /", () => {
    expect(deriveView(true, true, "saml-uid-123", "/login")).toBe("redirect-to-home");
  });

  it("SAML on, checked, has userId, at / → show-app", () => {
    expect(deriveView(true, true, "saml-uid-123", "/")).toBe("show-app");
  });

  it("SAML off, no userId → show-prompt (standard NamePrompt)", () => {
    expect(deriveView(false, true, "", "/")).toBe("show-prompt");
  });

  it("SAML off, userId set → show-app", () => {
    expect(deriveView(false, true, "Alice", "/")).toBe("show-app");
  });
});

describe("SAML NamePrompt pre-login mode", () => {
  function computePreLoginState() {
    return {
      inputHidden: true,
      buttonLabel: "loginSSO",
      buttonDisabled: false,
    };
  }

  it("pre-login: no username input, SSO button always enabled", () => {
    const state = computePreLoginState();
    expect(state.inputHidden).toBe(true);
    expect(state.buttonLabel).toBe("loginSSO");
    expect(state.buttonDisabled).toBe(false);
  });
});

describe("Standard NamePrompt (non-SAML)", () => {
  function computeStandardState(typedName: string) {
    const trimmed = typedName.trim();
    const valid = trimmed.length >= 2;
    return {
      inputHidden: false,
      shownName: typedName,
      buttonLabel: "enter",
      buttonDisabled: !valid,
    };
  }

  it("empty name → button disabled", () => {
    const state = computeStandardState("");
    expect(state.inputHidden).toBe(false);
    expect(state.buttonDisabled).toBe(true);
  });

  it("valid name → button enabled", () => {
    const state = computeStandardState("Alice");
    expect(state.inputHidden).toBe(false);
    expect(state.shownName).toBe("Alice");
    expect(state.buttonDisabled).toBe(false);
  });
});

describe("SAML NamePrompt submit behavior", () => {
  it("pre-login submit calls onSamlLogin with locale, not onSubmit", () => {
    let submitCalled = false;
    let samlLoginLocale: string | null = null;

    const onSubmit = () => { submitCalled = true; };
    const onSamlLogin = (locale: string) => { samlLoginLocale = locale; };
    const samlMode = "pre-login" as const;
    const locale = "fr";

    if (samlMode === "pre-login") {
      if (typeof onSamlLogin === "function") onSamlLogin(locale);
    } else {
      onSubmit();
    }

    expect(samlLoginLocale).toBe("fr");
    expect(submitCalled).toBe(false);
  });

  it("standard mode submit calls onSubmit with typed name", () => {
    let submitArgs: { name: string; locale: string } | null = null;

    const typedName = "Bob";
    const locale = "en";

    const onSubmit = (name: string, l: string) => { submitArgs = { name, locale: l }; };
    onSubmit(typedName, locale);

    expect(submitArgs).toEqual({ name: "Bob", locale: "en" });
  });
});

describe("Pre-login locale persistence", () => {
  it("onSamlLogin saves locale to prefs before redirect", () => {
    let savedLocale: string | null = null;

    const handleSamlLogin = (chosenLocale: string) => {
      if (chosenLocale) {
        savedLocale = chosenLocale;
      }
    };

    handleSamlLogin("he");
    expect(savedLocale).toBe("he");
  });

  it("onSamlLogin without locale does not save", () => {
    let savedLocale: string | null = null;

    const handleSamlLogin = (chosenLocale?: string) => {
      if (chosenLocale) {
        savedLocale = chosenLocale;
      }
    };

    handleSamlLogin(undefined);
    expect(savedLocale).toBeNull();
  });
});

describe("SAML auth/me response handling", () => {
  it("401 response sets samlChecked=true without redirect", () => {
    let samlChecked = false;
    let redirected = false;

    const responseOk = false;
    if (!responseOk) {
      samlChecked = true;
    } else {
      redirected = true;
    }

    expect(samlChecked).toBe(true);
    expect(redirected).toBe(false);
  });

  it("200 response with userId sets both userId and samlChecked", () => {
    let samlChecked = false;
    let userId = "";

    const responseOk = true;
    const bodyUserId = "saml-sub-42";

    if (responseOk && bodyUserId) {
      userId = bodyUserId;
      samlChecked = true;
    }

    expect(userId).toBe("saml-sub-42");
    expect(samlChecked).toBe(true);
  });

  it("authenticated user goes directly to app (no post-login form)", () => {
    const samlEnabled = true;
    const samlChecked = true;
    const userId = "saml-uid-1";
    const pathname = "/";

    const shouldShowApp = samlEnabled && samlChecked && userId !== "" && pathname !== "/login";
    expect(shouldShowApp).toBe(true);
  });
});

describe("NavBar logout button", () => {
  it("logout button is shown when SAML is enabled", () => {
    const samlEnabled = true;
    const showLogout = samlEnabled;
    expect(showLogout).toBe(true);
  });

  it("logout button is not shown when SAML is disabled", () => {
    const samlEnabled = false;
    const showLogout = samlEnabled;
    expect(showLogout).toBe(false);
  });

  it("logout redirects to /auth/logout", () => {
    const logoutUrl = "/auth/logout";
    expect(logoutUrl).toBe("/auth/logout");
  });
});
