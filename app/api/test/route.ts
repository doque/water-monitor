import { NextResponse } from "next/server"

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      message: "Test completed successfully",
    })
  } catch (error) {
    console.error("Error in test endpoint:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Test failed",
      },
      { status: 500 },
    )
  }
}
