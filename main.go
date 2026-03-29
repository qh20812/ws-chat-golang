package main

import (
	"fmt"
	"log"
	"main/src/auth"
	"main/src/chat"
	"main/src/common"
	"main/src/friend"
	"main/src/notify"
	"main/src/room"
	"main/src/user"

	"github.com/gin-gonic/gin"
)

func main() {
	common.LoadEnv()

	db := common.ConnectMongoDB()

	userRepo := user.NewRepository(db)
	userCtrl := user.NewController(userRepo)
	authCtrl := auth.NewController(userRepo)

	roomRepo := room.NewRepository(db)
	room.EnsureRoomIndex(roomRepo.Rooms)
	if err := room.EnsureRoomIndex(roomRepo.Rooms); err != nil {
		log.Fatal("Can not create index because index exist!")
	}
	roomCtrl := room.NewController(roomRepo)

	friendRepo := friend.NewRepository(db)
	friendCtrl := friend.NewController(friendRepo)

	go chat.WS.Run()
	go notify.NotifyWS.Run()

	r := gin.Default()

	r.GET("/", func(ctx *gin.Context) {
		ctx.String(200, "Welcome to my chat realtime")
	})
	r.POST("/api/register", userCtrl.Register)
	r.POST("/api/login", authCtrl.Login)
	r.PATCH("/api/user", auth.JWTMiddleware(), userCtrl.UpdateUser)
	r.POST("/api/friend/request", auth.JWTMiddleware(), friendCtrl.SendRequest)
	r.POST("/api/friend/accept", auth.JWTMiddleware(), friendCtrl.AcceptRequest)
	r.POST("/api/friend/refuse", auth.JWTMiddleware(), friendCtrl.RefuseRequest)
	r.GET("/api/friend/list", auth.JWTMiddleware(), friendCtrl.ListFriends)
	r.GET("/ws", chat.ServerWS)
	r.POST("/api/room", auth.JWTMiddleware(), roomCtrl.Create)
	r.GET("/api/room", auth.JWTMiddleware(), roomCtrl.GetRoom)
	r.GET("/ws/notify", notify.ServerWS)

	port := common.GetEnv("PORT")
	fmt.Println("Server is running at http://localhost" + port)
	r.Run(port)
}
