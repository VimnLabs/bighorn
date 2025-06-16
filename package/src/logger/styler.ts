/** Log levels enum */
export enum Level {
	Note = 'Note',
	Warn = 'Warn',
	Echo = 'Echo',
	Fail = 'Fail'
}

/** AnsiStyles colors */
export enum Styles {
	Reset = 0,
	ResetBold = 22,
	ResetItalic = 23,
	ResetUnderline = 24,
	ResetBlik = 25,
	ResetInverse = 27,
	ResetHidden = 28,
	ResetStrikethrough = 29,
	ResetColor = 39,
	ResetBgColor = 49,

	// Text Styles
	Bold = 1,
	Dim = 2,
	Italic = 3,
	Underline = 4,
	Blink = 5,
	Inverse = 7,
	Hidden = 8,
	Strikethrough = 9,

	// Text Colors
	RGBColor = '38;2',
	BITColor = '38;5',
	RGBBackground = '48;2',
	BITBackground = '48;5',

	Black = 30,
	Red = 31,
	Green = 32,
	Yellow = 33,
	Blue = 34,
	Magenta = 35,
	Cyan = 36,
	White = 37,

	BrightBlack = 90,
	BrightRed = 91,
	BrightGreen = 92,
	BrightYellow = 93,
	BrightBlue = 94,
	BrightMagenta = 95,
	BrightCyan = 96,
	BrightWhite = 97,

	// Background Colors
	BgBlack = 40,
	BgRed = 41,
	BgGreen = 42,
	BgYellow = 43,
	BgBlue = 44,
	BgMagenta = 45,
	BgCyan = 46,
	BgWhite = 47,

	BgBrightBlack = 100,
	BgBrightRed = 101,
	BgBrightGreen = 102,
	BgBrightYellow = 103,
	BgBrightBlue = 104,
	BgBrightMagenta = 105,
	BgBrightCyan = 106,
	BgBrightWhite = 107
}

/** Generates an ANSI escape for the provided styles */
export function paint(...styles: Styles[]): `\u001B[${string}m` {
	return `\x1b[${styles.join(';')}m`;
}

export function style({ text, styles }: { text: string; styles: Styles[] }) {
	const RESET_INDEX = styles.indexOf(Styles.Reset);
	return (
		(RESET_INDEX === -1
			? paint(...styles)
			: paint(...styles.splice(RESET_INDEX))) +
		text +
		paint(Styles.Reset)
	);
}
