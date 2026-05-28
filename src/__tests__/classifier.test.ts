/**
 * @jest-environment node
 *
 * Unit test for classifyEmail. The AI provider wrapper is mocked.
 */

jest.mock("@/lib/ai/client", () => ({
  callModel: jest.fn(),
}));

import { callModel } from "@/lib/ai/client";
import { classifyEmail } from "@/lib/ai/classifier";

const mockedCallModel = callModel as jest.MockedFunction<typeof callModel>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("classifyEmail", () => {
  it("returns the mocked category IDs from the model", async () => {
    mockedCallModel.mockResolvedValueOnce({ categoryIds: ["cat-1"] });

    const result = await classifyEmail({
      subject: "Your invoice from Acme",
      body: "Please find your invoice attached.",
      categories: [
        { id: "cat-1", name: "Finance", description: "Bills and invoices" },
        { id: "cat-2", name: "Travel", description: "Trips and bookings" },
      ],
    });

    expect(result).toEqual({ categoryIds: ["cat-1"] });
    expect(mockedCallModel).toHaveBeenCalledTimes(1);
  });

  it("short-circuits to an empty list when no categories are provided", async () => {
    const result = await classifyEmail({
      subject: "Hello",
      body: "World",
      categories: [],
    });

    expect(result).toEqual({ categoryIds: [] });
    expect(mockedCallModel).not.toHaveBeenCalled();
  });
});
