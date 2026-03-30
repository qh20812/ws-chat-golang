package callsignal

import (
	"log"
	"main/src/chat"

	"github.com/gin-gonic/gin"
)

func ServeSignalingWS(c *gin.Context) {
	userID := c.Query("user")

	conn, err := chat.UPGRADER.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("Websocket upgrade failed!", err)
		return
	}
	client := &chat.Client{
		Conn:   conn,
		UserID: userID,
		Send:   make(chan []byte),
	}

	//register client to signaling clients
	signalingClients[userID]=client
	go client.WritePump()

	//read message
	go SignalMessages(client)
	
}
