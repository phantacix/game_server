/*
*	描述：公会实现类
*	作者：李俊良
*	时间：2016/05/10
*/

function Guild() {
	this.guild_info = new Guild_Info();
	this.drop_list = new Array();
}

Guild.prototype.load_data = function(buffer){
	print('load guild data, util.now_msec:', util.now_msec());
	this.guild_info.deserialize(buffer);
}

Guild.prototype.save_data = function(){
	var msg = new MSG_150102();
	this.guild_info.guild_map.each(function(key,value,index) {
		if (value.change) {
			msg.guild_info.guild_map.insert(value.guild_id, value);
			value.change = false;
		}
    });
	var buf = pop_master_buffer();
	buf.make_inner_message(Msg_MD.SYNC_MASTER_DB_SAVE_GUILD_INFO);
	msg.serialize(buf);
	buf.finish_message();
	send_master_buffer_to_db(buf);
	push_master_buffer(buf);
}

Guild.prototype.drop_guild = function(){
	if (this.drop_list.length <= 0) return;
		
	var msg = new MSG_150103();
	msg.guild_list = this.drop_list;
	var buf = pop_master_buffer();
	buf.make_inner_message(Msg_MD.SYNC_MASTER_DB_DROP_GUILD_INFO);
	msg.serialize(buf);
	buf.finish_message();
	send_master_buffer_to_db(buf);
	push_master_buffer(buf);
	this.drop_list = [];
}

Guild.prototype.sync_guild_info_to_game = function(player, guild_id, guild_name){
	var msg = new MSG_160100();
	msg.guild_id = guild_id;
	msg.guild_name = guild_name;
	var buf = pop_master_buffer();
	msg.serialize(buf);
	player.cplayer.sync_data_to_game(Msg_GM.SYNC_MASTER_GAME_GUILD_INFO, buf);
	push_master_buffer(buf);
}

Guild.prototype.save_data_handler = function() {
	this.save_data();
	this.drop_guild();
}

Guild.prototype.member_join_guild = function(player, guild_detail) {
	var member_detail = new Guild_Member_Detail();
	member_detail.role_id = player.player_info.role_id;
	member_detail.role_name = player.player_info.role_name;
	member_detail.level = player.player_info.level;
	member_detail.career = player.player_info.career;
	guild_detail.member_list.push(member_detail);
}

Guild.prototype.get_guild_id = function(){
	var max_id = 0;
	if(this.guild_info.guild_map.size() == 0){
		max_id = config.server_json['agent_num'] * 10000000000000 
			+ config.server_json['server_num'] * 1000000000;
	}
	else {
		for(var i = 0; i < this.guild_info.guild_map.size(); i++){
			if(this.guild_info.guild_map.keys[i] > max_id){
				max_id = this.guild_info.guild_map.keys[i];
			}
		}
	}
	return max_id + 1;
}

Guild.prototype.create_guild = function(player, buffer) {
	print('create_guild, util.now_msec:', util.now_msec());
	var msg = new MSG_110101();
	msg.deserialize(buffer);

	var guild_detail = new Guild_Detail();
	guild_detail.change = true;
	guild_detail.guild_id = this.get_guild_id();
	guild_detail.guild_name = msg.guild_name;
	guild_detail.chief_id = player.player_info.role_id;

	this.member_join_guild(player, guild_detail);
	this.guild_info.guild_map.insert(guild_detail.guild_id, guild_detail);
	this.sync_guild_info_to_game(player, guild_detail.guild_id, guild_detail.guild_name);
	
	var msg_res = new MSG_510101();
	msg_res.guild_id = guild_detail.guild_id;
	var buf = pop_master_buffer();
	msg_res.serialize(buf);
	player.cplayer.respond_success_result(Msg_MC.RES_CREATE_GUILD, buf);
	push_master_buffer(buf);
}

Guild.prototype.dissove_guild = function(player, buffer) {
	print('dissove_guild, util.now_msec:', util.now_msec());
	var msg = new MSG_110102();
	msg.deserialize(buffer);
	var guild_detail = this.guild_info.guild_map.get(msg.guild_id);
	if(guild_detail == null){
		print('guild ', msg.guild_id, " not exist!");
		return;
	}
	for(var i = 0; i < guild_detail.member_list.length; i++){
		var mem_player = master_player_role_id_map.get(guild_detail.member_list[i].role_id);
		if(mem_player == null){
			//离线数据，保存到离线数据列表
			offline_manager.set_offline_detail(player, guild_detail.guild_id, guild_detail.guild_name);
		} else {
			this.sync_guild_info_to_game(mem_player, 0, "");
		}
	}
	this.guild_info.guild_map.remove(msg.guild_id);
	this.drop_list.push(msg.guild_id);
	
	var msg_res = new MSG_510102();
	msg_res.guild_id = msg.guild_id;
	var buf = pop_master_buffer();
	msg_res.serialize(buf);
	player.cplayer.respond_success_result(Msg_MC.RES_DISSOVE_GUILD, buf);
	push_master_buffer(buf);
}

Guild.prototype.join_guild = function(player, buffer) {
	print('join_guild, util.now_msec:', util.now_msec());
	var msg = new MSG_110103();
	msg.deserialize(buffer);
	var guild_detail = this.guild_info.guild_map.get(msg.guild_id);
	if(guild_detail == null){
		print('guild ', msg.guild_id, " not exist!");
		return;
	}
	guild_detail.applicant_list.push(player.player_info.role_id);
	guild_detail.change = true;
	
	var msg_res = new MSG_510103();
	var buf = pop_master_buffer();
	msg_res.serialize(buf);
	player.cplayer.respond_success_result(Msg_MC.RES_JOIN_GUILD, buf);
	push_master_buffer(buf);
}

