import { describe, expect, it } from "@jest/globals";
import { anonymizeText } from "../anonymizeText";

describe("anonymizeText", () => {
  // --- Email addresses ---
  describe("emails", () => {
    it("redacts a single email address", () => {
      expect(anonymizeText("Contact us at john.smith@example.co.uk for details")).toBe(
        "Contact us at [EMAIL] for details",
      );
    });

    it("redacts multiple email addresses", () => {
      expect(anonymizeText("Email admin@fire.com or support@safety.org")).toBe(
        "Email [EMAIL] or [EMAIL]",
      );
    });
  });

  // --- Phone numbers ---
  describe("phone numbers", () => {
    it("redacts UK mobile numbers", () => {
      expect(anonymizeText("Call 07700 900123")).toBe("Call [PHONE]");
    });

    it("redacts UK landline numbers", () => {
      expect(anonymizeText("Tel: 0120 234 5678")).toBe("Tel: [PHONE]");
    });

    it("redacts +44 international format", () => {
      expect(anonymizeText("Phone: +44 20 7946 0958")).toBe("Phone: [PHONE]");
    });

    it("redacts numbers with dashes", () => {
      expect(anonymizeText("Fax: 020-7946-0958")).toBe("Fax: [PHONE]");
    });
  });

  // --- Reference numbers ---
  describe("reference numbers", () => {
    it("redacts REF-style references", () => {
      expect(anonymizeText("See REF-12345 for details")).toBe("See [REFERENCE] for details");
    });

    it("redacts UPRN numbers", () => {
      expect(anonymizeText("UPRN: 100023456789")).toBe("[REFERENCE]");
    });

    it("redacts invoice references", () => {
      const result = anonymizeText("Invoice No. INV-00045");
      expect(result).not.toContain("INV-00045");
      expect(result).toContain("[REFERENCE]");
    });

    it("redacts FRA references", () => {
      const result = anonymizeText("Ref: FRA-2024-0042");
      expect(result).not.toContain("FRA-2024-0042");
      expect(result).toContain("[REFERENCE]");
    });
  });

  // --- UK postcodes ---
  describe("postcodes", () => {
    it("redacts standard postcode with space", () => {
      expect(anonymizeText("Located at SW1A 1AA")).toBe("Located at [POSTCODE]");
    });

    it("redacts postcode without space", () => {
      expect(anonymizeText("Postcode: EC2R8AH")).toBe("Postcode: [POSTCODE]");
    });

    it("redacts short-format postcode", () => {
      expect(anonymizeText("Area: M1 1AA")).toBe("Area: [POSTCODE]");
    });
  });

  // --- Person names ---
  describe("person names", () => {
    it("redacts honorific-based names", () => {
      expect(anonymizeText("Mr John Smith conducted the assessment")).toBe(
        "[NAME] conducted the assessment",
      );
    });

    it("redacts Dr. with period", () => {
      expect(anonymizeText("Dr. Alice Brown")).toBe("[NAME]");
    });

    it("redacts label-based names with 'Assessed by'", () => {
      expect(anonymizeText("Assessed by: Jane Doe")).toBe("[NAME]");
    });

    it("redacts label-based names with 'Client:'", () => {
      expect(anonymizeText("Client: Robert Johnson")).toBe("[NAME]");
    });

    it("redacts label-based names with 'Prepared for:'", () => {
      expect(anonymizeText("Prepared for: Sarah Williams")).toBe("[NAME]");
    });

    it("redacts label-based names with 'Landlord:'", () => {
      expect(anonymizeText("Landlord: Michael Davies")).toBe("[NAME]");
    });
  });

  // --- Company names ---
  describe("company names", () => {
    it("redacts Ltd companies", () => {
      expect(anonymizeText("Smith & Jones Ltd")).toBe("[COMPANY]");
    });

    it("redacts Limited companies", () => {
      expect(anonymizeText("Acme Fire Safety Services Limited")).toBe("[COMPANY]");
    });

    it("redacts PLC companies", () => {
      expect(anonymizeText("UK Housing PLC")).toBe("[COMPANY]");
    });
  });

  // --- Street addresses ---
  describe("addresses", () => {
    it("redacts flat + street address", () => {
      expect(anonymizeText("Flat 4, 23 High Street")).toBe("[ADDRESS]");
    });

    it("redacts house number + street", () => {
      expect(anonymizeText("123 Victoria Road")).toBe("[ADDRESS]");
    });

    it("redacts unit address", () => {
      expect(anonymizeText("Unit 7, 45 Park Lane")).toBe("[ADDRESS]");
    });

    it("redacts named buildings", () => {
      expect(anonymizeText("Oakwood House")).toBe("[ADDRESS]");
    });

    it("redacts various street types", () => {
      expect(anonymizeText("89 Church Avenue")).toBe("[ADDRESS]");
    });
  });

  // --- Integration test ---
  describe("integration", () => {
    it("redacts all PII types in a realistic paragraph", () => {
      const input =
        "Fire Risk Assessment for 42 Baker Street, London SW1A 1AA. " +
        "Prepared by: Dr. Sarah Mitchell of ABC Fire Safety Ltd. " +
        "Contact: sarah@abcfire.co.uk, 07700 123456. " +
        "UPRN: 100023456789. Ref: FRA-2024-0042.";

      const result = anonymizeText(input);

      expect(result).not.toContain("42 Baker Street");
      expect(result).not.toContain("SW1A 1AA");
      expect(result).not.toContain("Sarah Mitchell");
      expect(result).not.toContain("ABC Fire Safety Ltd");
      expect(result).not.toContain("sarah@abcfire.co.uk");
      expect(result).not.toContain("07700 123456");
      expect(result).not.toContain("100023456789");
      expect(result).not.toContain("FRA-2024-0042");

      expect(result).toContain("[ADDRESS]");
      expect(result).toContain("[POSTCODE]");
      expect(result).toContain("[EMAIL]");
      expect(result).toContain("[PHONE]");
      expect(result).toContain("[REFERENCE]");
    });
  });

  // --- No false positives ---
  describe("no false positives", () => {
    it("does not modify generic text without PII", () => {
      const text = "The fire risk assessment found 3 fire doors in poor condition.";
      expect(anonymizeText(text)).toBe(text);
    });

    it("does not redact standalone street-type words", () => {
      const text = "The building is on a main road near the park.";
      expect(anonymizeText(text)).toBe(text);
    });

    it("does not redact plain numbers that are not phone numbers", () => {
      const text = "There are 15 floors and 200 residents.";
      expect(anonymizeText(text)).toBe(text);
    });
  });
});
