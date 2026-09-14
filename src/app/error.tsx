"use client";
export default function ErrorPage({reset}: {reset: () => void}) {return <div className="page empty"><h1>We lost the conversation for a moment.</h1><p>Please try again. Your account and saved groups are safe.</p><button className="button primary" onClick={reset}>Try again</button></div>;}
