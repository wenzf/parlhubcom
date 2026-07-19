import { useLocation } from "react-router"


export function useCurrentURL() {
    let location = useLocation()
    return location.pathname + location.search
}