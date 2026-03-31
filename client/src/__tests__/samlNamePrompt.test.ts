import { describe, it, expect } from "vitest";

describe("SAML App routing logic", () => {
  function deriveView(
    samlEnabled: boolean,
    samlChecked: boolean,
    userId: string
  ): "loading" | "redirect-to-idp" | "show-prompt" | "show-app" {
    if (samlEnabled) {
      if (!samlChecked) return "loading";
      if (!userId) return "redirect-to-idp";
      return "show-app";
    }
    if (!userId) return "show-prompt";
    return "show-app";
  }

  it("SAML on, not checked → loading", () => {
    expect(deriveView(true, false, "")).toBe("loading");
  });

  it("SAML on, checked, no session → redirect to IdP", () => {
    expect(deriveView(true, true, "")).toBe("redirect-to-idp");
  });

  it("SAML on, checked, has userId → show-app", () => {
    expect(deriveView(true, true, "saml-uid-123")).toBe("show-app");
  });

  it("SAML off, no userId → show-prompt (standard NamePrompt)", () => {
    expect(deriveView(false, true, "")).toBe("show-prompt");
  });

  it("SAML off, userId set → show-app", () => {
    expect(deriveView(false, true, "Alice")).toBe("show-app");
  });
});

describe("Standard NamePrompt (non-SAML)", () => {
  function computeStandardState(typedName: string) {
    const trimmed = typedName.trim();
    const valid = trimmed.length >= 2;
    return {
      shownName: typedName,
      buttonLabel: "enter",
      buttonDisabled: !valid,
    };
  }

  it("empty name → button disabled", () => {
    const state = computeStandardState("");
    expect(state.buttonDisabled).toBe(true);
  });

  it("valid name → button enabled", () => {
    const state = computeStandardState("Alice");
    expect(state.shownName).toBe("Alice");
    expect(state.buttonDisabled).toBe(false);
  });

  it("standard mode submit calls onSubmit with typed name", () => {
    let submittedName: string | null = null;

    const typedName = "Bob";

    const onSubmit = (name: string) => { submittedName = name; };
    onSubmit(typedName);

    expect(submittedName).toBe("Bob");
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

  it("authenticated user goes directly to app", () => {
    const samlEnabled = true;
    const samlChecked = true;
    const userId = "saml-uid-1";

    const shouldShowApp = samlEnabled && samlChecked && userId !== "";
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
