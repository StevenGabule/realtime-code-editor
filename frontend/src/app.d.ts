export interface CursorPosition {
	userId: string;
	line: number;
	ch: number;
	color: string;
}

export interface RemoteCursor {
	userId: string;
	position: CursorPosition;
}