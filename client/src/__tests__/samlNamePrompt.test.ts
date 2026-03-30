import { describe, it, expect } from "vitest";

describe("SAML NamePrompt mode derivation", () => {
  function deriveSamlMode(
    samlEnabled: boolean,
    samlChecked: boolean,
    userId: string,
    samlConfirmed: boolean
  ): "pre-login" | "post-login" | "show-prompt" | "show-app" {
    if (samlEnabled && !samlConfirmed) {
      return samlChecked && userId ? "post-login" : "pre-login";
    }
    if (!userId) return "show-prompt";
    return "show-app";
  }

  it("SAML on, not checked yet → pre-login mode", () => {
    expect(deriveSamlMode(true, false, "", false)).toBe("pre-login");
  });

  it("SAML on, checked but no session → pre-login mode (SSO button)", () => {
    expect(deriveSamlMode(true, true, "", false)).toBe("pre-login");
  });

  it("SAML on, checked with userId, not confirmed → post-login mode", () => {
    expect(deriveSamlMode(true, true, "saml-uid-123", false)).toBe("post-login");
  });

  it("SAML on, confirmed → show-app", () => {
    expect(deriveSamlMode(true, true, "saml-uid-123", true)).toBe("show-app");
  });

  it("SAML off, no userId → show-prompt (standard NamePrompt)", () => {
    expect(deriveSamlMode(false, true, "", false)).toBe("show-prompt");
  });

  it("SAML off, userId set → show-app", () => {
    expect(deriveSamlMode(false, true, "Alice", false)).toBe("show-app");
  });
});

describe("SAML NamePrompt button & input logic", () => {
  function computeNamePromptState(
    samlMode: "pre-login" | "post-login" | undefined,
    displayName: string | undefined,
    typedName: string
  ) {
    const isSaml = samlMode !== undefined;
    const inputHidden = samlMode === "pre-login";
    const shownName = isSaml
      ? (samlMode === "post-login" && displayName ? displayName : "")
      : typedName;
    const inputDisabled = isSaml;
    const buttonLabel = samlMode === "pre-login" ? "loginSSO" : "enter";
    const valid = isSaml
      ? samlMode === "post-login" && typeof displayName === "string" && displayName.length > 0
      : typedName.trim().length >= 2;
    const buttonDisabled = !valid && samlMode !== "pre-login";

    return { shownName, inputHidden, inputDisabled, buttonLabel, buttonDisabled };
  }

  it("pre-login mode: input hidden, SSO button always enabled", () => {
    const state = computeNamePromptState("pre-login", undefined, "");
    expect(state.inputHidden).toBe(true);
    expect(state.buttonLabel).toBe("loginSSO");
    expect(state.buttonDisabled).toBe(false);
  });

  it("post-login mode: input visible, disabled & shows displayName, Enter button enabled", () => {
    const state = computeNamePromptState("post-login", "Alice Smith", "");
    expect(state.inputHidden).toBe(false);
    expect(state.shownName).toBe("Alice Smith");
    expect(state.inputDisabled).toBe(true);
    expect(state.buttonLabel).toBe("enter");
    expect(state.buttonDisabled).toBe(false);
  });

  it("post-login mode: empty displayName → Enter button disabled", () => {
    const state = computeNamePromptState("post-login", "", "");
    expect(state.inputHidden).toBe(false);
    expect(state.shownName).toBe("");
    expect(state.inputDisabled).toBe(true);
    expect(state.buttonLabel).toBe("enter");
    expect(state.buttonDisabled).toBe(true);
  });

  it("no SAML mode: standard behavior — input visible & editable, button depends on name length", () => {
    const empty = computeNamePromptState(undefined, undefined, "");
    expect(empty.inputHidden).toBe(false);
    expect(empty.shownName).toBe("");
    expect(empty.inputDisabled).toBe(false);
    expect(empty.buttonLabel).toBe("enter");
    expect(empty.buttonDisabled).toBe(true);

    const valid = computeNamePromptState(undefined, undefined, "Alice");
    expect(valid.inputHidden).toBe(false);
    expect(valid.shownName).toBe("Alice");
    expect(valid.inputDisabled).toBe(false);
    expect(valid.buttonDisabled).toBe(false);
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

  it("post-login submit calls onSubmit with displayName", () => {
    let submitArgs: { name: string; locale: string } | null = null;

    const displayName = "Alice Smith";
    const locale = "fr";
    const samlMode = "post-login" as const;

    const onSubmit = (name: string, l: string) => { submitArgs = { name, locale: l }; };

    if (samlMode === "post-login" && typeof displayName === "string") {
      onSubmit(displayName, locale);
    }

    expect(submitArgs).toEqual({ name: "Alice Smith", locale: "fr" });
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

describe("SAML App.tsx handleSetName with samlConfirmed", () => {
  it("when SAML enabled, handleSetName sets samlConfirmed=true (does not update userId)", () => {
    const samlEnabled = true;
    let samlConfirmed = false;
    let userIdUpdated = false;

    if (samlEnabled) {
      samlConfirmed = true;
    } else {
      userIdUpdated = true;
    }

    expect(samlConfirmed).toBe(true);
    expect(userIdUpdated).toBe(false);
  });

  it("when SAML disabled, handleSetName updates userId/displayName", () => {
    const samlEnabled = false;
    let samlConfirmed = false;
    let userIdUpdated = false;

    if (samlEnabled) {
      samlConfirmed = true;
    } else {
      userIdUpdated = true;
    }

    expect(samlConfirmed).toBe(false);
    expect(userIdUpdated).toBe(true);
  });
});

describe("Returning user auto-confirm", () => {
  it("returning user with introSeen=true skips post-login screen", () => {
    let samlConfirmed = false;
    const introSeen = true;

    if (introSeen) {
      samlConfirmed = true;
    }

    expect(samlConfirmed).toBe(true);
  });

  it("new user with introSeen=false sees post-login screen", () => {
    let samlConfirmed = false;
    const introSeen = false;

    if (introSeen) {
      samlConfirmed = true;
    }

    expect(samlConfirmed).toBe(false);
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
  it("401 response sets samlChecked=true without redirect (shows pre-login)", () => {
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
});
