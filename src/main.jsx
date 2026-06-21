import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import './index.css'
import App from './App.jsx'

const convexUrl = import.meta.env.VITE_CONVEX_URL

function createConvexClient() {
	return new ConvexReactClient(convexUrl)
}

function AppProviders() {
	const [convexClient, setConvexClient] = useState(createConvexClient)

	useEffect(() => {
		const reconnectClient = () => {
			if (document.visibilityState === 'hidden') {
				return
			}

			setConvexClient(currentClient => {
				window.setTimeout(() => {
					void currentClient.close()
				}, 0)
				return createConvexClient()
			})
		}

		window.addEventListener('pageshow', reconnectClient)
		window.addEventListener('focus', reconnectClient)
		window.addEventListener('online', reconnectClient)
		document.addEventListener('visibilitychange', reconnectClient)

		return () => {
			window.removeEventListener('pageshow', reconnectClient)
			window.removeEventListener('focus', reconnectClient)
			window.removeEventListener('online', reconnectClient)
			document.removeEventListener('visibilitychange', reconnectClient)
		}
	}, [])

	return (
		<ConvexProvider client={convexClient}>
			<App />
		</ConvexProvider>
	)
}

createRoot(document.getElementById('root')).render(
	<StrictMode>
		<AppProviders />
	</StrictMode>,
)
