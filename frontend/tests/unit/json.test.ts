import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseJsonColumn, parseStringArrayColumn } from "@/server/json";

describe("server/json", () => {
  it("string[] カラムを型安全に復元できる", () => {
    expect(
      parseStringArrayColumn({
        columnName: "question_ids_json",
        raw: '["q-1","q-2"]',
      }),
    ).toEqual(["q-1", "q-2"]);
  });

  it("JSON 構文が壊れている場合は INTERNAL を投げる", () => {
    try {
      parseStringArrayColumn({
        columnName: "question_ids_json",
        raw: '["q-1"',
      });
      throw new Error("expected parseStringArrayColumn to throw");
    } catch (error) {
      expect(error).toMatchObject({
        code: "INTERNAL",
        message: "question_ids_json の保存形式が不正です",
      });
    }
  });

  it("schema と一致しない場合は INTERNAL を投げる", () => {
    try {
      parseStringArrayColumn({
        columnName: "choices_json",
        raw: "[1,2,3,4]",
      });
      throw new Error("expected parseStringArrayColumn to throw");
    } catch (error) {
      expect(error).toMatchObject({
        code: "INTERNAL",
        message: "choices_json の保存形式が不正です",
      });
    }
  });

  it("汎用 schema でも型安全に復元できる", () => {
    const articles = parseJsonColumn({
      columnName: "articles",
      raw: '[{"articleKey":"hn-1-0","title":"React 20","url":"https://example.com/react-20"}]',
      schema: z.array(
        z.object({
          articleKey: z.string(),
          title: z.string(),
          url: z.string().url(),
        }),
      ),
    });

    expect(articles[0]?.articleKey).toBe("hn-1-0");
  });
});
