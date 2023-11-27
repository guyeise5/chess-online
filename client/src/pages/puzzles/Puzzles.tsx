import {ReactElement, useEffect, useState} from "react";
import axios from "axios";
import SinglePuzzle from "./SinglePuzzle";
import {BLACK, Chess, Color, WHITE} from "chess.js";
import ShowSolution from "./ShowSolution";
import {useSearchParams} from "react-router-dom";

type Puzzle = {
    puzzleId: string,
    fen: string,
    moves: string[],
    rating: number,
    ratingDeviation: number,
    popularity: number,
}

export default function (): ReactElement {
    const [rate, setRate] = useState<number>(Number(localStorage.getItem("puzzle-rate")) || 400)
    const [puzzle, setPuzzle] = useState<Puzzle | undefined>()
    const [color, setColor] = useState<Color>(WHITE)
    const [searchParams, setSearchParams] = useSearchParams();
    const puzzleId = searchParams.get("puzzleId")
    const [showSolution, setShowSolution] = useState<boolean>(false)
    useEffect(() => {
        if (!puzzle) {
            return
        }
        setColor(new Chess(puzzle.fen).turn() === WHITE ? BLACK : WHITE)
    }, [puzzle]);

    useEffect(() => {
        localStorage.setItem("puzzle-rate", rate.toString())
    }, [rate]);
    function fetchPuzzle(rate: number, id?: string) {
        if(id) {
            axios.get<Puzzle>(`/api/v1/puzzle/${id}`)
                .then(resp => {
                    setPuzzle(resp.data)
                })
            return
        }
        axios.get<Puzzle>(`/api/v1/puzzle/byRating/${rate}`)
            .then(resp => {
            setPuzzle(resp.data)
            setSearchParams(params => {
                params.set("puzzleId", resp.data.puzzleId)
                return params
            })
        })
    }

    useEffect(() => {
        fetchPuzzle(rate, puzzleId || undefined)
    }, []);

    function onPuzzleFinish(newRating: number) {
        if (!puzzle) {
            return
        }
        console.log("new rate", newRating)
        setRate(newRating)
        setSearchParams(params => {
            params.delete("puzzleId")
            return params
        })
        setShowSolution(false)
        setPuzzle(undefined)
        fetchPuzzle(newRating)
    }

    function onShowSolutionClicked() {
        setShowSolution(true)
    }

    function puzzleOrSolution() {
        if (!puzzle) {
            return <div></div>
        }

        if (showSolution) {
            return <ShowSolution moves={puzzle.moves} fen={puzzle.fen}
                                 boardOrientation={color == "b" ? "black" : "white"}
                                 nextPuzzleClick={() => onPuzzleFinish(rate)}/>
        }

        return <SinglePuzzle color={color}
                             fen={puzzle.fen}
                             moves={puzzle.moves}
                             next={onPuzzleFinish}
                             rating={rate}
                             setRating={setRate}
                             showSolutionEvent={onShowSolutionClicked}
        />
    }

    return <div>
        <h1>
            {color === BLACK ? "Black" : "White"} to play.
        </h1>
        <h3>
            rating: {rate}
        </h3>
        {puzzleOrSolution()}
    </div>
}