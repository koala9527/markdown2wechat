import { NextResponse } from "next/server";
import { getDefaultThemeName, listThemeNames } from "../../../lib/theme";

export async function GET() {
  try {
    const themes = listThemeNames();
    const defaultTheme = getDefaultThemeName();
    return NextResponse.json({
      success: true,
      themes,
      defaultTheme,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        success: false,
        error: e?.message || String(e),
      },
      { status: 500 }
    );
  }
}


