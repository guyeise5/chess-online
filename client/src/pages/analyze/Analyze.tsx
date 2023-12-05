import MyChessBoard from "../my-chess-board/MyChessBoard";
import {Chess, DEFAULT_POSITION, Square, WHITE} from "chess.js";
import {useEffect, useMemo, useState} from "react";
import {MinimalMove, toColorFromString, toPromotion} from "../game/utils";
import {useSearchParams} from "react-router-dom";
import {Engine} from './Engine'
import {Arrow} from "react-chessboard/dist/chessboard/types";
import {tryOrUndefined} from "../../utils";

export default function () {
    const [params, setParams] = useSearchParams()

    const color = toColorFromString(params.get("color")) || WHITE
    const fen = params.get("fen") || DEFAULT_POSITION
    const chess = useMemo(() => new Chess(fen), [fen])
    const engine = useMemo(() => new Engine(), [])
    const depth = Number(params.get("depth")) || 10
    const [arrows, setArrows] = useState<Arrow[]>([])

    useEffect(() => {
        engine.onMessage(stockfishMove => {
            setArrows([[stockfishMove.from, stockfishMove.to, 'green']])
        })
    }, [engine]);
    useEffect(() => {
        if(chess.isGameOver()) {
            setArrows([])
        }
        engine.evaluatePosition(fen, depth)
    }, [fen]);

    function onPieceDrop(from: Square, to: Square, piece: string): boolean {
        if (!from || !to) {
            return false
        }

        const mv: MinimalMove = {
            from: from,
            to: to,
            promotion: toPromotion(piece?.[1]?.toLowerCase() || "")
        };

        tryOrUndefined(() => chess.move(mv))
        setParams(params => {
            params.set("fen", chess.fen())
            return params
        })

        return true
    }

    return <MyChessBoard color={color}
                         fen={fen}
                         onPieceDrop={onPieceDrop}
                         isDraggablePiece={() => true}
                         customArrows={arrows}
    />
}