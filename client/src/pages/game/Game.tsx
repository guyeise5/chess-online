import {Color, Square} from "chess.js";
import Clock from "../clock/Clock";
import MyChessBoard from "../my-chess-board/MyChessBoard";
import {chessFromPgn, MinimalMove, toPromotion, toSquare} from "./utils";
import {useMemo} from "react";
import axios from "axios";
import {Piece} from "react-chessboard/dist/chessboard/types";

type GameProps = {
    pgn: string,
    color: Color
    myTime: number,
    gameId: string
    opponentTime: number
}
export default function (props: GameProps) {
    const chess = useMemo(() => chessFromPgn(props.pgn), [props.pgn])

    function doMove(move: MinimalMove): boolean {
        try {
            chess.move(move)
            axios.post(`/api/v2/game/${props.gameId}/move`, move).catch(e => console.error(e))
            return true
        } catch (e) {
            console.log("failed to move", e)
            return false
        }
    }

    function onPieceDrop(sourceSquare: string, targetSquare: string, piece: string): boolean {
        const from = toSquare(sourceSquare)
        const to = toSquare(targetSquare)
        if (!from || !to) {
            return false
        }

        const mv: MinimalMove = {
            from: from,
            to: to,
            promotion: toPromotion(piece?.[1]?.toLowerCase() || "")
        };

        if (chess?.turn() !== props.color) {
            return true
        } else {
            return doMove(mv)
        }
    }


    function isDraggablePiece({piece}: { piece: Piece; sourceSquare: Square; }): boolean {
        return piece[0] == props.color
    }

    return <div id={"mainGameDiv"}>
        {props.opponentTime != Infinity && <Clock seconds={props.opponentTime}/>}
        <MyChessBoard color={props.color}
                      fen={chess?.fen()}
                      onPieceDrop={onPieceDrop}
                      isDraggablePiece={isDraggablePiece}
                      arePremovesAllowed={true}
        />

        {props.myTime != Infinity && <Clock seconds={props.myTime}/>}
    </div>
}