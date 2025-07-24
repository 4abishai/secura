package com.secura.service;

import com.secura.dto.UserRegistrationRequest;
import com.secura.dto.UserResponse;
import com.secura.entity.User;
import com.secura.repository.UserRepository;
import com.secura.exception.UserAlreadyExistsException;
import com.secura.exception.UserNotFoundException;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class UserService {

    @Autowired
    private UserRepository userRepository;

    public UserResponse registerUser(UserRegistrationRequest request) {
        String normalizedPhone = request.getPhoneNumber().replaceAll("\\s", "");

        if (userRepository.existsByPhoneNumber(normalizedPhone)) {
            throw new UserAlreadyExistsException("User with phone number " + normalizedPhone + " already exists");
        }

        User user = new User();
        user.setId(UUID.randomUUID().toString());
        user.setPhoneNumber(normalizedPhone);
        user.setKeyBundle(request.getKeyBundle());
        user.setRegisteredAt(LocalDateTime.now());

        User savedUser = userRepository.save(user);

        return new UserResponse(savedUser.getId(), savedUser.getPhoneNumber(), savedUser.getRegisteredAt());
    }

    public String getUserKeyBundle(String userId) {
        return userRepository.findById(userId)
                .map(User::getKeyBundle)
                .orElseThrow(() -> new UserNotFoundException("User not found: " + userId));
    }

    public UserResponse getUserById(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found: " + userId));
        return new UserResponse(user.getId(), user.getPhoneNumber(), user.getRegisteredAt());
    }

    public UserResponse getUserByPhoneNumber(String phoneNumber) {
        String normalizedPhone = phoneNumber.replaceAll("\\s", "");
        User user = userRepository.findByPhoneNumber(normalizedPhone)
                .orElseThrow(() -> new UserNotFoundException("User not found with phone: " + normalizedPhone));
        return new UserResponse(user.getId(), user.getPhoneNumber(), user.getRegisteredAt());
    }

    public List<UserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .map(user -> new UserResponse(user.getId(), user.getPhoneNumber(), user.getRegisteredAt()))
                .collect(Collectors.toList());
    }

    public boolean userExists(String userId) {
        return userRepository.existsById(userId);
    }

    public void deleteUser(String userId) {
        if (!userRepository.existsById(userId)) {
            throw new UserNotFoundException("User not found: " + userId);
        }
        userRepository.deleteById(userId);
    }
}
